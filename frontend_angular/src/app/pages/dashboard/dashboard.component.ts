import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  reunion = signal<any>({
    titulo: 'Sesión Ordinaria del Consejo',
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'en curso',
  });

  intervencionActual = signal<any>(null);
  cola = signal<any[]>([]);
  historial = signal<any[]>([]);

  segundos = signal(300);
  preparacionSegundos = signal(10);
  preparando = signal(false);
  participantePreparando = signal<any>(null);
  corriendo = signal(false);

  horaActual = signal('');
  fechaActual = signal('');
  segundosReunion = signal(0);
  reunionCorriendo = signal(false);
  modoPresentacion = signal(false);
  intervencionesPausadas = signal(false);

  private intervalId: any = null;
  private refreshId: any = null;
  private preparacionId: any = null;
  private relojId: any = null;
  private reunionId: any = null;
  private iniciandoAutomatico = false;
  private historialLocalItems: any[] = [];

  private ocultarHistorialDashboard =
    sessionStorage.getItem('ocultarHistorialDashboard') === '1';

  private historialInicioId = Number(
    sessionStorage.getItem('historialInicioId') || 0
  );

  private fullscreenHandler = () => {
    if (!document.fullscreenElement && this.modoPresentacion()) {
      this.modoPresentacion.set(false);
      document.body.classList.remove('modo-presentacion');
      window.dispatchEvent(new Event('modo-presentacion-change'));
    }
  };

  tiempo = computed(() => {
    const min = Math.floor(this.segundos() / 60).toString().padStart(2, '0');
    const sec = (this.segundos() % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  });

  tiempoReunion = computed(() => {
    const horas = Math.floor(this.segundosReunion() / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((this.segundosReunion() % 3600) / 60).toString().padStart(2, '0');
    const segundos = (this.segundosReunion() % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
  });

  estadoTiempo = computed(() => {
    if (this.segundos() <= 60) return 'rojo';
    if (this.segundos() <= 180) return 'amarillo';
    return 'verde';
  });

  fechaReunion = computed(() => this.formatearFecha(this.reunion()?.fecha));

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
    this.actualizarReloj();

    this.relojId = setInterval(() => this.actualizarReloj(), 1000);
    this.refreshId = setInterval(() => this.loadData(false), 3000);

    document.addEventListener('fullscreenchange', this.fullscreenHandler);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    clearInterval(this.refreshId);
    clearInterval(this.preparacionId);
    clearInterval(this.relojId);
    clearInterval(this.reunionId);

    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.body.classList.remove('modo-presentacion');
    window.dispatchEvent(new Event('modo-presentacion-change'));
  }

  async loadData(showLoading = true): Promise<void> {
    await this.cargarReunionActiva();
    await this.cargarIntervenciones();
    await this.cargarHistorial();
  }

  private async cargarReunionActiva(): Promise<void> {
    try {
      const res: any = await this.api.get('/reuniones-activa');
      const reunion = res?.data ?? res;

      if (reunion?.id) {
        this.reunion.set(reunion);
      } else {
        this.historialLocalItems = [];
        this.historial.set([]);
      }
    } catch (error) {
      console.error('Error cargando reunión activa:', error);
    }
  }

  private async obtenerUltimoHistorialId(): Promise<number> {
    const res: any = await this.api.get('/historial?page=1');

    const items =
      res?.data?.data?.data ??
      res?.data?.data ??
      res?.data ??
      [];

    if (!Array.isArray(items) || items.length === 0) {
      return 0;
    }

    return Math.max(...items.map((item: any) => Number(item.id || 0)));
  }

  private async cargarIntervenciones(): Promise<void> {
    try {
      const res: any = await this.api.get('/intervenciones');
      const data = res?.data ?? res ?? [];
      const lista = Array.isArray(data) ? data : data.data ?? [];

      const visibles = lista.filter((item: any) =>
        ['aun no intervino', 'interviniendo'].includes(item.status)
      );

      const actual =
        visibles.find((item: any) => item.status === 'interviniendo') ?? null;

      const pendientes = visibles
        .filter((item: any) => item.status === 'aun no intervino')
        .sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      this.intervencionActual.set(actual);
      this.cola.set(pendientes);

      const reunion =
        actual?.participante?.reunion ?? pendientes[0]?.participante?.reunion;

      if (reunion) {
        this.reunion.set(reunion);
      }

      if (actual && !this.corriendo()) {
        this.segundos.set(300);
        this.iniciarCronometro();
        return;
      }

      if (
        !actual &&
        pendientes.length > 0 &&
        !this.preparando() &&
        !this.intervencionesPausadas()
      ) {
        await this.prepararSiguiente(pendientes[0]);
        return;
      }

      if (!actual && pendientes.length === 0 && !this.preparando()) {
        this.detenerCronometro();
        this.segundos.set(300);
      }
    } catch (error) {
      console.error('Error cargando intervenciones:', error);
    }
  }

  private async prepararSiguiente(siguiente: any): Promise<void> {
    if (this.iniciandoAutomatico || this.intervencionesPausadas()) return;

    this.iniciandoAutomatico = true;
    this.participantePreparando.set(siguiente);
    this.preparacionSegundos.set(10);
    this.preparando.set(true);

    clearInterval(this.preparacionId);

    this.preparacionId = setInterval(async () => {
      if (this.intervencionesPausadas()) {
        clearInterval(this.preparacionId);
        this.preparando.set(false);
        this.participantePreparando.set(null);
        this.iniciandoAutomatico = false;
        return;
      }

      if (this.preparacionSegundos() > 1) {
        this.preparacionSegundos.update(v => v - 1);
        return;
      }

      clearInterval(this.preparacionId);
      await this.iniciarIntervencionReal(siguiente);
    }, 1000);
  }

  private async iniciarIntervencionReal(item: any): Promise<void> {
    if (this.intervencionesPausadas()) return;

    try {
      await this.api.put(`/intervenciones/${item.id}`, {
        status: 'interviniendo',
        hora_inicio: new Date().toTimeString().slice(0, 8),
      });

      this.preparando.set(false);
      this.participantePreparando.set(null);
      this.iniciandoAutomatico = false;
      this.segundos.set(300);

      await this.cargarIntervenciones();
      this.iniciarCronometro();
    } catch (error) {
      console.error('Error iniciando intervención:', error);
      this.preparando.set(false);
      this.iniciandoAutomatico = false;
    }
  }

  togglePausaIntervenciones(): void {
    this.intervencionesPausadas.update(v => !v);

    if (this.intervencionesPausadas()) {
      clearInterval(this.preparacionId);
      this.preparando.set(false);
      this.participantePreparando.set(null);
      this.iniciandoAutomatico = false;
    } else {
      this.cargarIntervenciones();
    }
  }

  async manejarPulsoEsp32(): Promise<void> {
    if (this.intervencionesPausadas()) {
      alert('Las intervenciones están pausadas.');
      return;
    }

    if (this.preparando() && this.participantePreparando()) {
      await this.cancelarPreparacion();
      return;
    }

    if (this.intervencionActual()) {
      await this.finalizarIntervencion();
      return;
    }

    const siguiente = this.cola()[0];
    if (siguiente) await this.prepararSiguiente(siguiente);
  }

  async cancelarPreparacion(): Promise<void> {
    const participante = this.participantePreparando();
    if (!participante) return;

    clearInterval(this.preparacionId);

    try {
      await this.api.put(`/intervenciones/${participante.id}`, {
        status: 'fin intervencion',
        hora_fin: new Date().toTimeString().slice(0, 8),
      });
    } catch (error) {
      console.error('Error cancelando preparación:', error);
    }

    this.agregarHistorialLocal(
      'Intervención cancelada',
      this.nombreParticipante(participante)
    );

    this.preparando.set(false);
    this.participantePreparando.set(null);
    this.iniciandoAutomatico = false;
  }

  async finalizarIntervencion(): Promise<void> {
    const actual = this.intervencionActual();
    if (!actual) return;

    const nombre = this.nombreParticipante(actual);

    try {
      await this.api.put(`/intervenciones/${actual.id}`, {
        status: 'fin intervencion',
        hora_fin: new Date().toTimeString().slice(0, 8),
      });

      this.agregarHistorialLocal('Intervención finalizada', nombre);

      this.detenerCronometro();
      this.segundos.set(300);
      await this.cargarIntervenciones();
    } catch (error) {
      console.error('Error finalizando intervención:', error);
    }
  }

  private async cargarHistorial(): Promise<void> {
    const reunionActual = this.reunion();
    const status = reunionActual?.status || reunionActual?.estado;

    if (
      this.ocultarHistorialDashboard ||
      status !== 'activa' ||
      !this.historialInicioId
    ) {
      this.historialLocalItems = [];
      this.historial.set([]);
      return;
    }

    try {
      const histRes: any = await this.api.get('/historial?page=1');

      const historialItems =
        histRes?.data?.data?.data ??
        histRes?.data?.data ??
        histRes?.data ??
        [];

      const lista = Array.isArray(historialItems) ? historialItems : [];

      const soloIntervenciones = lista
        .filter((item: any) => this.esHistorialIntervencionVisible(item))
        .filter((item: any) => Number(item.id || 0) > this.historialInicioId)
        .map((item: any) => ({
          ...item,
          participante_nombre: this.extraerNombreHistorial(item),
        }));

      this.historial.set(
        [...this.historialLocalItems, ...soloIntervenciones].slice(0, 8)
      );
    } catch {
      this.historial.set(this.historialLocalItems.slice(0, 8));
    }
  }

  private esHistorialIntervencionVisible(item: any): boolean {
    const tabla = String(item?.tabla || '').toLowerCase();
    const operacion = String(item?.operacion || '').toLowerCase();

    const esIntervencion = tabla === 'intervenciones';

    const mencionaIntervencion =
      operacion.includes('intervención') ||
      operacion.includes('intervencion');

    const esActualizar =
      operacion === 'actualizar intervención' ||
      operacion === 'actualizar intervencion';

    return esIntervencion && mencionaIntervencion && !esActualizar;
  }

  private agregarHistorialLocal(operacion: string, nombre: string): void {
    if (!this.historialInicioId) return;

    this.historialLocalItems.unshift({
      id: `local-${Date.now()}`,
      operacion,
      participante_nombre: nombre,
      tabla: 'intervenciones',
      created_at: new Date().toISOString(),
    });

    this.historial.set(this.historialLocalItems.slice(0, 8));
  }

  private extraerNombreHistorial(item: any): string {
    if (typeof item?.dato?.participante === 'string') {
      return item.dato.participante;
    }

    return (
      item?.participante_nombre ||
      item?.dato?.participante_nombre ||
      item?.dato?.despues?.participante_nombre ||
      item?.dato?.despues?.participante?.miembro?.nombre ||
      item?.dato?.despues?.participante?.invitado?.nombre ||
      item?.dato?.participante?.miembro?.nombre ||
      item?.dato?.participante?.invitado?.nombre ||
      item?.dato?.nombre ||
      'Participante'
    );
  }

  iniciarCronometro(): void {
    clearInterval(this.intervalId);
    this.corriendo.set(true);

    this.intervalId = setInterval(() => {
      if (this.segundos() > 0) {
        this.segundos.update(v => v - 1);
      } else {
        this.detenerCronometro();
      }
    }, 1000);
  }

  detenerCronometro(): void {
    this.corriendo.set(false);
    clearInterval(this.intervalId);
  }

  reiniciarCronometro(): void {
    this.segundos.set(300);
    if (this.intervencionActual()) this.iniciarCronometro();
  }

  async iniciarReunion(): Promise<void> {
    let reunion = this.reunion();

    try {
      if (!reunion?.id) {
        const res: any = await this.api.get('/reuniones-activa');
        reunion = res?.data ?? res;

        if (reunion?.id) {
          this.reunion.set(reunion);
        }
      }

      if (!reunion?.id) {
        alert('No hay reunión registrada para iniciar.');
        return;
      }

      this.historialLocalItems = [];
      this.historial.set([]);

      this.ocultarHistorialDashboard = false;
      sessionStorage.removeItem('ocultarHistorialDashboard');

      this.historialInicioId = await this.obtenerUltimoHistorialId();
      sessionStorage.setItem('historialInicioId', String(this.historialInicioId));

      await this.api.post(`/reuniones/${reunion.id}/iniciar`, {});

      this.intervencionesPausadas.set(false);
      this.segundosReunion.set(0);
      this.iniciarCronometroReunion();

      await this.cargarReunionActiva();
      await this.cargarHistorial();
    } catch (error) {
      console.error(error);
      alert('No se pudo iniciar la reunión.');
    }
  }

  async terminarReunion(): Promise<void> {
    const reunion = this.reunion();

    if (!reunion?.id) {
      alert('No hay reunión seleccionada para terminar.');
      return;
    }

    try {
      await this.api.post(`/reuniones/${reunion.id}/terminar`, {});

      this.intervencionActual.set(null);
      this.cola.set([]);

      this.detenerCronometroReunion();
      this.segundosReunion.set(0);
      this.detenerCronometro();
      this.segundos.set(300);

      clearInterval(this.preparacionId);
      this.preparando.set(false);
      this.participantePreparando.set(null);
      this.iniciandoAutomatico = false;
      this.intervencionesPausadas.set(false);

      this.historialLocalItems = [];
      this.historial.set([]);

      this.ocultarHistorialDashboard = true;
      sessionStorage.setItem('ocultarHistorialDashboard', '1');

      this.historialInicioId = 0;
      sessionStorage.removeItem('historialInicioId');

      await this.cargarReunionActiva();
    } catch (error) {
      console.error(error);
      alert('No se pudo terminar la reunión.');
    }
  }

  iniciarCronometroReunion(): void {
    clearInterval(this.reunionId);

    this.reunionCorriendo.set(true);

    this.reunionId = setInterval(() => {
      this.segundosReunion.update(v => v + 1);
    }, 1000);
  }

  detenerCronometroReunion(): void {
    clearInterval(this.reunionId);
    this.reunionCorriendo.set(false);
  }

  actualizarReloj(): void {
    const now = new Date();

    this.horaActual.set(
      now.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );

    this.fechaActual.set(
      now.toLocaleDateString('es-MX', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
  }

  nombreParticipante(item: any): string {
    return (
      item?.participante?.miembro?.nombre ||
      item?.participante?.invitado?.nombre ||
      item?.participante_nombre ||
      item?.nombre ||
      'Sin participante'
    );
  }

  tipoParticipante(item: any): string {
    if (item?.participante?.miembro) return 'Miembro del Consejo';
    if (item?.participante?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(item: any): string {
    return item?.participante?.miembro?.rfid || item?.participante?.rfid || 'Sin RFID';
  }

  nombreHistorialIntervencion(item: any): string {
    return item?.participante_nombre || this.extraerNombreHistorial(item);
  }

  pantallaCompleta(): void {
    this.modoPresentacion.update(v => !v);

    document.body.classList.toggle('modo-presentacion', this.modoPresentacion());
    window.dispatchEvent(new Event('modo-presentacion-change'));

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  formatearFecha(fecha: string | null | undefined): string {
    if (!fecha) return 'Fecha no disponible';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  formatearFechaHora(fecha: string | null | undefined): string {
    if (!fecha) return 'Sin fecha';

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;

    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
