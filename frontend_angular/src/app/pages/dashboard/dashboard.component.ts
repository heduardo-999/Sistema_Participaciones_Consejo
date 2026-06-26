import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  reunion = signal<any>({
    id: null,
    titulo: null,
    sesion: null,
    fecha: new Date().toISOString().slice(0, 10),
    status: null,
    hora_inicio: null,
    hora_fin: null,
    inicio_real_at: null,
    fin_real_at: null,
    intervenciones_pausadas: false,
    intervenciones_pausadas_at: null,
  });

  intervencionActual = signal<any>(null);
  cola = signal<any[]>([]);
  historial = signal<any[]>([]);

  temaActual = signal<any>(null);
  loadingTemaActual = signal(false);
  completandoTemaActual = signal(false);

  preparacionSegundos = signal(10);
  preparacionIniciaAt = signal<number | null>(null);
  preparando = signal(false);
  participantePreparando = signal<any>(null);

  horaActual = signal('');
  fechaActual = signal('');
  modoPresentacion = signal(false);
  intervencionesPausadas = signal(false);
  menuControlAbierto = signal(false);

  serverOffsetMs = signal(0);
  serverNowMs = signal(Date.now());

  pausaIntervencionIniciaAt = signal<number | null>(null);

  private refreshId: any = null;
  private preparacionId: any = null;
  private relojId: any = null;

  private iniciandoAutomatico = false;
  private finalizandoAutomatico = false;
  private intervencionPausadaId: number | null = null;

  private historialLocalItems: any[] = [];
  private readonly LIMITE_HISTORIAL_DASHBOARD = 10;

  private ocultarHistorialDashboard =
    sessionStorage.getItem('ocultarHistorialDashboard') === '1';

  private historialInicioId = Number(
    sessionStorage.getItem('historialInicioId') || 0
  );

  reunionIniciada = computed(() => {
    const status = String(
      this.reunion()?.status || this.reunion()?.estado || ''
    ).toLowerCase();

    return status === 'activa';
  });

  tituloPrincipal = computed(() => {
    const reunion = this.reunion();

    if (!reunion?.id) {
      return 'Esperando Reunión';
    }

    return reunion?.titulo || reunion?.sesion || 'Esperando Reunión';
  });

  estadoPrincipal = computed(() => {
    const reunion = this.reunion();

    if (!reunion?.id) {
      return 'Sin reunión';
    }

    return reunion?.status || reunion?.estado || 'Programada';
  });

  tiempoReunion = computed(() => {
    const reunion = this.reunion();

    if (!this.reunionIniciada() || !reunion?.inicio_real_at) {
      return '00:00:00';
    }

    const inicio = new Date(reunion.inicio_real_at).getTime();

    const fin = reunion.fin_real_at
      ? new Date(reunion.fin_real_at).getTime()
      : this.serverNowMs();

    const transcurrido = Math.max(0, fin - inicio);

    return this.formatearDuracion(transcurrido);
  });

  segundos = computed(() => {
    const actual = this.intervencionActual();

    if (!this.reunionIniciada() || !actual?.inicio_real_at) {
      return 300;
    }

    const inicio = new Date(actual.inicio_real_at).getTime();

    const fin = actual.fin_real_at
      ? new Date(actual.fin_real_at).getTime()
      : this.serverNowMs();

    let pausaMs = 0;
    const pausaInicio = this.pausaIntervencionIniciaAt();

    if (this.intervencionesPausadas() && pausaInicio) {
      pausaMs = Math.max(0, this.serverNowMs() - pausaInicio);
    }

    const transcurrido = Math.floor((fin - inicio - pausaMs) / 1000);
    const restante = 300 - transcurrido;

    return Math.max(0, restante);
  });

  segundosPreparacion = computed(() => {
    const inicio = this.preparacionIniciaAt();

    if (!this.preparando() || !inicio || this.intervencionesPausadas()) {
      return 10;
    }

    const transcurrido = Math.floor((this.serverNowMs() - inicio) / 1000);
    const restante = 10 - transcurrido;

    return Math.max(0, restante);
  });

  tiempo = computed(() => {
    const total = this.segundos();
    const min = Math.floor(total / 60);
    const sec = total % 60;

    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  estadoTiempo = computed(() => {
    const segundos = this.segundos();

    if (segundos > 180) return 'verde';
    if (segundos > 60) return 'amarillo';
    return 'rojo';
  });

  fechaReunion = computed(() => this.formatearFecha(this.reunion()?.fecha));

  horarioPrevisto = computed(() => {
    const inicio = this.formatearHora(this.reunion()?.hora_inicio);
    const fin = this.formatearHora(this.reunion()?.hora_fin);

    if (inicio === 'Sin hora' && fin === 'Sin hora') {
      return 'Horario previsto no registrado';
    }

    return `${inicio} - ${fin}`;
  });

  private fullscreenHandler = () => {
    if (!document.fullscreenElement && this.modoPresentacion()) {
      this.modoPresentacion.set(false);
      document.body.classList.remove('modo-presentacion');
      window.dispatchEvent(new Event('modo-presentacion-change'));
    }
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.detenerTimers();

    this.loadData();
    this.actualizarReloj();

    this.relojId = setInterval(() => {
      this.actualizarReloj();
      this.serverNowMs.set(Date.now() + this.serverOffsetMs());
      this.revisarFinAutomaticoIntervencion();
    }, 1000);

    this.refreshId = setInterval(() => {
      this.loadData(false);
    }, 5000);

    document.addEventListener('fullscreenchange', this.fullscreenHandler);
  }

  ngOnDestroy(): void {
    this.detenerTimers();

    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.body.classList.remove('modo-presentacion');
    window.dispatchEvent(new Event('modo-presentacion-change'));
  }

  private detenerTimers(): void {
    if (this.refreshId) {
      clearInterval(this.refreshId);
      this.refreshId = null;
    }

    if (this.preparacionId) {
      clearInterval(this.preparacionId);
      this.preparacionId = null;
    }

    if (this.relojId) {
      clearInterval(this.relojId);
      this.relojId = null;
    }
  }

  toggleMenuControl(): void {
    this.menuControlAbierto.update(v => !v);
  }

  cerrarMenuControl(): void {
    this.menuControlAbierto.set(false);
  }

  async loadData(showLoading = true): Promise<void> {
    await this.cargarReunionActiva();

    if (this.reunionIniciada()) {
      await this.cargarTemaActual();
      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } else {
      this.temaActual.set(null);
      this.intervencionActual.set(null);
      this.cola.set([]);
      this.historial.set([]);
      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();
      this.iniciandoAutomatico = false;
      this.finalizandoAutomatico = false;
    }
  }

  private placeholderReunion(): any {
    return {
      id: null,
      titulo: null,
      sesion: null,
      fecha: new Date().toISOString().slice(0, 10),
      status: null,
      hora_inicio: null,
      hora_fin: null,
      inicio_real_at: null,
      fin_real_at: null,
      intervenciones_pausadas: false,
      intervenciones_pausadas_at: null,
    };
  }

  private obtenerPayload(res: any): any {
    return res?.data?.data ?? res?.data ?? res ?? null;
  }

  private obtenerServerNow(res: any): string | null {
    return res?.server_now ?? res?.data?.server_now ?? null;
  }

  private sincronizarHoraServidor(serverNow: string | null | undefined): void {
    if (!serverNow) return;

    const serverMs = new Date(serverNow).getTime();

    if (Number.isNaN(serverMs)) return;

    const nuevoOffset = serverMs - Date.now();
    const offsetActual = this.serverOffsetMs();

    if (Math.abs(nuevoOffset - offsetActual) < 2000) {
      return;
    }

    this.serverOffsetMs.set(nuevoOffset);
    this.serverNowMs.set(Date.now() + nuevoOffset);
  }

  private aplicarEstadoPausaDesdeReunion(reunion: any): void {
    const pausadas = Boolean(reunion?.intervenciones_pausadas);

    this.intervencionesPausadas.set(pausadas);

    if (pausadas) {
      this.limpiarPreparacion();
      this.iniciandoAutomatico = false;
      this.finalizandoAutomatico = false;

      const pausaMs = reunion?.intervenciones_pausadas_at
        ? new Date(reunion.intervenciones_pausadas_at).getTime()
        : this.serverNowMs();

      this.pausaIntervencionIniciaAt.set(
        Number.isNaN(pausaMs) ? this.serverNowMs() : pausaMs
      );

      return;
    }

    this.limpiarPausaIntervencion();
  }

  private async cargarReunionActiva(): Promise<void> {
    try {
      const res: any = await this.api.get('/reuniones-activa');

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const reunion = this.obtenerPayload(res);

      if (reunion?.id) {
        this.reunion.set({
          ...this.placeholderReunion(),
          ...reunion,
        });

        this.aplicarEstadoPausaDesdeReunion(reunion);
      } else {
        this.reunion.set(this.placeholderReunion());
        this.temaActual.set(null);
        this.historialLocalItems = [];
        this.historial.set([]);
        this.limpiarPreparacion();
        this.limpiarPausaIntervencion();
        this.intervencionesPausadas.set(false);
      }
    } catch (error) {
      console.error('Error cargando reunión activa:', error);
      this.reunion.set(this.placeholderReunion());
      this.temaActual.set(null);
    }
  }

  private async cargarTemaActual(): Promise<void> {
    const reunion = this.reunion();

    if (!reunion?.id || !this.reunionIniciada()) {
      this.temaActual.set(null);
      return;
    }

    this.loadingTemaActual.set(true);

    try {
      const res: any = await this.api.get(`/reuniones/${reunion.id}/tema-actual`);
      const tema = this.obtenerPayload(res);

      this.temaActual.set(tema?.id ? tema : null);
    } catch (error) {
      console.error('Error cargando tema actual:', error);
      this.temaActual.set(null);
    } finally {
      this.loadingTemaActual.set(false);
    }
  }

  async completarTemaActual(): Promise<void> {
    const tema = this.temaActual();

    if (!tema?.id) return;

    this.completandoTemaActual.set(true);

    try {
      const res: any = await this.api.post(`/temas-reunion/${tema.id}/completar`, {});
      const data = this.obtenerPayload(res);

      const siguienteTema =
        data?.siguiente_tema ??
        data?.data?.siguiente_tema ??
        null;

      this.temaActual.set(siguienteTema?.id ? siguienteTema : null);

      await this.cargarTemaActual();

      this.cerrarMenuControl();
    } catch (error) {
      console.error('Error completando tema actual:', error);
      alert('No se pudo completar el tema actual.');
    } finally {
      this.completandoTemaActual.set(false);
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
    if (!this.reunionIniciada()) {
      this.intervencionActual.set(null);
      this.cola.set([]);
      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();
      return;
    }

    try {
      const res: any = await this.api.get('/intervenciones');

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const data = this.obtenerPayload(res) ?? [];
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

      this.sincronizarPausaConIntervencion(actual);

      this.intervencionActual.set(actual);
      this.cola.set(pendientes);

      const reunion =
        actual?.participante?.reunion ?? pendientes[0]?.participante?.reunion;

      if (reunion) {
        this.reunion.set({
          ...this.reunion(),
          ...reunion,
        });

        this.aplicarEstadoPausaDesdeReunion({
          ...this.reunion(),
          ...reunion,
        });
      }

      if (this.intervencionesPausadas()) {
        this.limpiarPreparacion();
        return;
      }

      if (
        !actual &&
        pendientes.length > 0 &&
        !this.preparando() &&
        !this.iniciandoAutomatico &&
        !this.finalizandoAutomatico
      ) {
        await this.prepararSiguiente(pendientes[0]);
        return;
      }

      if (!actual && pendientes.length === 0 && !this.preparando()) {
        this.participantePreparando.set(null);
        this.preparacionIniciaAt.set(null);
      }
    } catch (error) {
      console.error('Error cargando intervenciones:', error);
    }
  }

  private sincronizarPausaConIntervencion(actual: any): void {
    const actualId = actual?.id ? Number(actual.id) : null;

    if (!actualId) {
      this.limpiarPausaIntervencion();
      return;
    }

    if (this.intervencionPausadaId !== actualId) {
      this.intervencionPausadaId = actualId;

      if (this.intervencionesPausadas() && !this.pausaIntervencionIniciaAt()) {
        const reunion = this.reunion();

        const pausaMs = reunion?.intervenciones_pausadas_at
          ? new Date(reunion.intervenciones_pausadas_at).getTime()
          : this.serverNowMs();

        this.pausaIntervencionIniciaAt.set(
          Number.isNaN(pausaMs) ? this.serverNowMs() : pausaMs
        );
      }
    }
  }

  private limpiarPausaIntervencion(): void {
    this.intervencionPausadaId = null;
    this.pausaIntervencionIniciaAt.set(null);
  }

  private async prepararSiguiente(siguiente: any): Promise<void> {
    if (this.iniciandoAutomatico || this.intervencionesPausadas()) return;

    this.iniciandoAutomatico = true;
    this.participantePreparando.set(siguiente);
    this.preparacionIniciaAt.set(this.serverNowMs());
    this.preparacionSegundos.set(10);
    this.preparando.set(true);

    if (this.preparacionId) {
      clearInterval(this.preparacionId);
      this.preparacionId = null;
    }

    this.preparacionId = setInterval(async () => {
      if (this.intervencionesPausadas()) {
        this.limpiarPreparacion();
        return;
      }

      const restante = this.segundosPreparacion();

      this.preparacionSegundos.set(restante);

      if (restante > 0) {
        return;
      }

      if (this.preparacionId) {
        clearInterval(this.preparacionId);
        this.preparacionId = null;
      }

      await this.iniciarIntervencionReal(siguiente);
    }, 250);
  }

  private async iniciarIntervencionReal(item: any): Promise<void> {
    if (this.intervencionesPausadas()) return;

    try {
      const res: any = await this.api.put(`/intervenciones/${item.id}`, {
        status: 'interviniendo',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();

      this.iniciandoAutomatico = false;

      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error iniciando intervención:', error);

      this.limpiarPreparacion();
      this.iniciandoAutomatico = false;
    }
  }

  private async revisarFinAutomaticoIntervencion(): Promise<void> {
    const actual = this.intervencionActual();

    if (!this.reunionIniciada()) return;
    if (!actual?.id) return;
    if (this.finalizandoAutomatico) return;
    if (this.intervencionesPausadas()) return;
    if (this.preparando()) return;
    if (this.iniciandoAutomatico) return;
    if (this.segundos() > 0) return;

    this.finalizandoAutomatico = true;

    const nombre = this.nombreParticipante(actual);

    try {
      const res: any = await this.api.put(`/intervenciones/${actual.id}`, {
        status: 'fin intervencion',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      this.agregarHistorialLocal('Intervención finalizada', nombre);

      this.intervencionActual.set(null);
      this.limpiarPausaIntervencion();

      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error finalizando intervención automáticamente:', error);
    } finally {
      this.finalizandoAutomatico = false;
    }
  }

  private limpiarPreparacion(): void {
    if (this.preparacionId) {
      clearInterval(this.preparacionId);
      this.preparacionId = null;
    }

    this.preparando.set(false);
    this.participantePreparando.set(null);
    this.preparacionIniciaAt.set(null);
    this.preparacionSegundos.set(10);
    this.iniciandoAutomatico = false;
  }

  async togglePausaIntervenciones(): Promise<void> {
    const reunion = this.reunion();

    if (!reunion?.id || !this.reunionIniciada()) {
      alert('No hay reunión activa.');
      return;
    }

    try {
      const res: any = await this.api.post(
        `/reuniones/${reunion.id}/toggle-pausa-intervenciones`,
        {}
      );

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const reunionActualizada = this.obtenerPayload(res);

      if (reunionActualizada?.id) {
        this.reunion.set({
          ...this.reunion(),
          ...reunionActualizada,
        });

        this.aplicarEstadoPausaDesdeReunion(reunionActualizada);

        if (!Boolean(reunionActualizada.intervenciones_pausadas)) {
          await this.cargarIntervenciones();
        }
      }
    } catch (error) {
      console.error('Error cambiando pausa de intervenciones:', error);
      alert('No se pudo cambiar el estado de pausa de intervenciones.');
    } finally {
      this.cerrarMenuControl();
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

    if (siguiente) {
      await this.prepararSiguiente(siguiente);
    }
  }

  async cancelarPreparacion(): Promise<void> {
    const participante = this.participantePreparando();

    if (!participante) return;

    if (this.preparacionId) {
      clearInterval(this.preparacionId);
      this.preparacionId = null;
    }

    try {
      const res: any = await this.api.put(`/intervenciones/${participante.id}`, {
        status: 'fin intervencion',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));
    } catch (error) {
      console.error('Error cancelando preparación:', error);
    }

    this.agregarHistorialLocal(
      'Intervención cancelada',
      this.nombreParticipante(participante)
    );

    this.limpiarPreparacion();
  }

  async finalizarIntervencion(): Promise<void> {
    const actual = this.intervencionActual();

    if (!actual) return;

    const nombre = this.nombreParticipante(actual);

    try {
      const res: any = await this.api.put(`/intervenciones/${actual.id}`, {
        status: 'fin intervencion',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      this.agregarHistorialLocal('Intervención finalizada', nombre);

      this.intervencionActual.set(null);
      this.limpiarPausaIntervencion();

      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error finalizando intervención:', error);
    } finally {
      this.cerrarMenuControl();
    }
  }

  private async cargarHistorial(): Promise<void> {
    if (
      !this.reunionIniciada() ||
      this.ocultarHistorialDashboard ||
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
        [...this.historialLocalItems, ...soloIntervenciones]
          .slice(0, this.LIMITE_HISTORIAL_DASHBOARD)
      );
    } catch {
      this.historial.set(
        this.historialLocalItems.slice(0, this.LIMITE_HISTORIAL_DASHBOARD)
      );
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

    this.historialLocalItems = this.historialLocalItems.slice(
      0,
      this.LIMITE_HISTORIAL_DASHBOARD
    );

    this.historial.set(
      this.historialLocalItems.slice(0, this.LIMITE_HISTORIAL_DASHBOARD)
    );
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

  async reiniciarCronometro(): Promise<void> {
    const actual = this.intervencionActual();

    if (!actual) return;

    try {
      this.limpiarPausaIntervencion();

      const res: any = await this.api.put(`/intervenciones/${actual.id}`, {
        status: 'interviniendo',
        hora_inicio: new Date().toTimeString().slice(0, 8),
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      await this.cargarIntervenciones();
    } catch (error) {
      console.error('Error reiniciando cronómetro:', error);
    } finally {
      this.cerrarMenuControl();
    }
  }

  async iniciarReunion(): Promise<void> {
    let reunion = this.reunion();

    try {
      if (!reunion?.id) {
        const res: any = await this.api.get('/reuniones-activa');

        this.sincronizarHoraServidor(this.obtenerServerNow(res));

        reunion = this.obtenerPayload(res);

        if (reunion?.id) {
          this.reunion.set({
            ...this.placeholderReunion(),
            ...reunion,
          });
        }
      }

      if (!reunion?.id) {
        alert('No hay reunión programada para iniciar.');
        return;
      }

      this.historialLocalItems = [];
      this.historial.set([]);

      this.ocultarHistorialDashboard = false;
      sessionStorage.removeItem('ocultarHistorialDashboard');

      this.historialInicioId = await this.obtenerUltimoHistorialId();
      sessionStorage.setItem('historialInicioId', String(this.historialInicioId));

      const res: any = await this.api.post(`/reuniones/${reunion.id}/iniciar`, {});

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const reunionActualizada = this.obtenerPayload(res);

      if (reunionActualizada?.id) {
        this.reunion.set({
          ...this.placeholderReunion(),
          ...reunionActualizada,
        });

        this.aplicarEstadoPausaDesdeReunion(reunionActualizada);
      }

      this.intervencionesPausadas.set(false);
      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();
      this.finalizandoAutomatico = false;

      await this.cargarTemaActual();
      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error(error);
      alert('No se pudo iniciar la reunión.');
    } finally {
      this.cerrarMenuControl();
    }
  }

  async terminarReunion(): Promise<void> {
    const reunion = this.reunion();

    if (!reunion?.id) {
      alert('No hay reunión seleccionada para terminar.');
      return;
    }

    try {
      const res: any = await this.api.post(`/reuniones/${reunion.id}/terminar`, {});

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      this.intervencionActual.set(null);
      this.cola.set([]);
      this.temaActual.set(null);

      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();

      this.iniciandoAutomatico = false;
      this.finalizandoAutomatico = false;
      this.intervencionesPausadas.set(false);

      this.historialLocalItems = [];
      this.historial.set([]);

      this.ocultarHistorialDashboard = true;
      sessionStorage.setItem('ocultarHistorialDashboard', '1');

      this.historialInicioId = 0;
      sessionStorage.removeItem('historialInicioId');

      const reunionActualizada = this.obtenerPayload(res);

      if (reunionActualizada?.id) {
        this.reunion.set({
          ...this.placeholderReunion(),
          ...reunionActualizada,
        });
      } else {
        await this.cargarReunionActiva();
      }
    } catch (error) {
      console.error(error);
      alert('No se pudo terminar la reunión.');
    } finally {
      this.cerrarMenuControl();
    }
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

    return partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : fecha;
  }

  formatearHora(hora: string | null | undefined): string {
    if (!hora) return 'Sin hora';

    const partes = hora.toString().split(':');

    if (partes.length >= 2) {
      return `${partes[0]}:${partes[1]}`;
    }

    return hora;
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

  formatearDuracion(ms: number): string {
    const totalSegundos = Math.floor(ms / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    return [
      horas.toString().padStart(2, '0'),
      minutos.toString().padStart(2, '0'),
      segundos.toString().padStart(2, '0'),
    ].join(':');
  }
}