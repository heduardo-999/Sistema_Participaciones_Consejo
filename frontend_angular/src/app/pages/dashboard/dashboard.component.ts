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

  private intervalId: any = null;
  private refreshId: any = null;
  private preparacionId: any = null;
  private iniciandoAutomatico = false;
  private historialLocalItems: any[] = [];

  tiempo = computed(() => {
    const min = Math.floor(this.segundos() / 60).toString().padStart(2, '0');
    const sec = (this.segundos() % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
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
    this.refreshId = setInterval(() => this.loadData(false), 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    clearInterval(this.refreshId);
    clearInterval(this.preparacionId);
  }

  async loadData(showLoading = true): Promise<void> {
    await this.cargarIntervenciones();
    await this.cargarHistorial();
  }

  private async cargarIntervenciones(): Promise<void> {
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

    if (reunion) this.reunion.set(reunion);

    if (actual && !this.corriendo()) {
      this.segundos.set(300);
      this.iniciarCronometro();
      return;
    }

    if (!actual && pendientes.length > 0 && !this.preparando()) {
      await this.prepararSiguiente(pendientes[0]);
      return;
    }

    if (!actual && pendientes.length === 0 && !this.preparando()) {
      this.detenerCronometro();
      this.segundos.set(300);
    }
  }

  private async prepararSiguiente(siguiente: any): Promise<void> {
    if (this.iniciandoAutomatico) return;

    this.iniciandoAutomatico = true;
    this.participantePreparando.set(siguiente);
    this.preparacionSegundos.set(10);
    this.preparando.set(true);

    clearInterval(this.preparacionId);

    this.preparacionId = setInterval(async () => {
      if (this.preparacionSegundos() > 1) {
        this.preparacionSegundos.update(v => v - 1);
        return;
      }

      clearInterval(this.preparacionId);
      await this.iniciarIntervencionReal(siguiente);
    }, 1000);
  }

  private async iniciarIntervencionReal(item: any): Promise<void> {
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

  async manejarPulsoEsp32(): Promise<void> {
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

    await this.loadData();
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
      await this.loadData();
    } catch (error) {
      console.error('Error finalizando intervención:', error);
    }
  }

  private async cargarHistorial(): Promise<void> {
    try {
      const histRes: any = await this.api.get('/historial');

      const historialItems =
        histRes?.data?.data?.data ??
        histRes?.data?.data ??
        histRes?.data ??
        [];

      const lista = Array.isArray(historialItems) ? historialItems : [];

      const soloIntervenciones = lista
        .filter((item: any) => this.esHistorialIntervencionVisible(item))
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
    const mencionaIntervencion = operacion.includes('intervención');

    const esActualizar =
      operacion === 'actualizar intervención' ||
      operacion === 'actualizar intervencion';

    return esIntervencion && mencionaIntervencion && !esActualizar;
  }

  private agregarHistorialLocal(operacion: string, nombre: string): void {
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