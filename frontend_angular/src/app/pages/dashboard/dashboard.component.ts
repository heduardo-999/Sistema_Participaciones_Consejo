import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
    intervenciones_automaticas: false,
  });

  intervencionActual = signal<any>(null);
  cola = signal<any[]>([]);
  historial = signal<any[]>([]);

  votacion = signal<any>(null);
  resultadosVotacion = signal<any>({
    si: 0,
    no: 0,
    abstencion: 0,
    total: 0,
  });
  mostrarModalVotacion = signal(false);
  incluirInvitadosVotacion = signal(false);
  nombreVotacionGuardar = signal('');
  iniciandoVotacion = signal(false);
  terminandoVotacion = signal(false);
  guardandoVotacion = signal(false);
  mostrarResultadoVotacionVisualizador = signal(true);

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
  sonidoHabilitado = signal(sessionStorage.getItem('sonidoDashboard') === '1');

  private audioContext: AudioContext | null = null;
  private sonidoMarcadoresInicializados = false;
  private ultimoActualSonidoId: string | null = null;
  private ultimoPreparandoSonidoId: string | null = null;
  private ultimosColaSonidoIds = new Set<string>();

  private normalizarRolUsuario(role: any): string {
    if (!role) return '';

    if (typeof role === 'string') {
      return role.trim().toLowerCase();
    }

    return String(
      role?.name ??
      role?.nombre ??
      role?.role ??
      role?.rol ??
      role?.guard_name ??
      ''
    ).trim().toLowerCase();
  }

  esVisualizador = computed(() => {
    const roles = (this.auth.user()?.roles ?? [])
      .map((role: any) => this.normalizarRolUsuario(role))
      .filter(Boolean);

    const tieneRolOperativo = roles.some((role: string) =>
      [
        'super admin',
        'super-admin',
        'super_admin',
        'admin',
        'administrador',
        'moderador',
      ].includes(role)
    );

    if (tieneRolOperativo) {
      return false;
    }

    return roles.includes('visualizador');
  });
  intervencionesPausadas = signal(false);
  menuControlAbierto = signal(false);

  serverOffsetMs = signal(0);
  serverNowMs = signal(Date.now());

  pausaIntervencionIniciaAt = signal<number | null>(null);

  private refreshId: any = null;
  private preparacionId: any = null;
  private relojId: any = null;
  private votacionVisualizadorTimer: any = null;
  private ultimaVotacionFinalizadaVisualizadorKey = '';

  private iniciandoAutomatico = false;
  private finalizandoAutomatico = false;
  private intervencionPausadaId: number | null = null;

  private historialLocalItems: any[] = [];
  private readonly LIMITE_HISTORIAL_DASHBOARD = 10;

  mostrarHistorialIntervenciones = signal(
    sessionStorage.getItem('mostrarHistorialDashboard') === '1'
  );

  historialVisible = computed(() =>
    this.mostrarHistorialIntervenciones()
  );

  votacionActiva = computed(() =>
    String(this.votacion()?.status || '').trim().toLowerCase() === 'activa'
  );

  votacionFinalizada = computed(() =>
    ['finalizada', 'guardada'].includes(String(this.votacion()?.status || '').trim().toLowerCase())
  );

  mostrarBloqueVotacionDashboard = computed(() => {
    if (!this.votacion()) return false;
    if (!this.esVisualizador()) return true;
    if (this.votacionActiva()) return true;
    return this.mostrarResultadoVotacionVisualizador();
  });

  porcentajeVotacionSi = computed(() => {
    const total = Number(this.resultadosVotacion()?.total || 0);
    return total ? Math.round((Number(this.resultadosVotacion()?.si || 0) / total) * 100) : 0;
  });

  porcentajeVotacionNo = computed(() => {
    const total = Number(this.resultadosVotacion()?.total || 0);
    return total ? Math.round((Number(this.resultadosVotacion()?.no || 0) / total) * 100) : 0;
  });

  porcentajeVotacionAbstencion = computed(() => {
    const total = Number(this.resultadosVotacion()?.total || 0);
    return total ? Math.round((Number(this.resultadosVotacion()?.abstencion || 0) / total) * 100) : 0;
  });

  graficaVotacionStyle = computed(() => {
    const total = Number(this.resultadosVotacion()?.total || 0);

    if (!total) {
      return {
        background: 'conic-gradient(#cbd5e1 0deg 360deg)',
      };
    }

    const si = (Number(this.resultadosVotacion()?.si || 0) / total) * 360;
    const no = (Number(this.resultadosVotacion()?.no || 0) / total) * 360;
    const abstencion = 360 - si - no;

    return {
      background: `conic-gradient(#22c55e 0deg ${si}deg, #ef4444 ${si}deg ${si + no}deg, #f59e0b ${si + no}deg ${si + no + abstencion}deg)`,
    };
  });

  intervencionesAutomaticas = computed(() =>
    Boolean(this.reunion()?.intervenciones_automaticas)
  );

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

  constructor(
    private api: ApiService,
    private realtime: RealtimeService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.detenerTimers();

    this.loadData();
    this.actualizarReloj();

    this.relojId = setInterval(() => {
      this.actualizarReloj();
      this.serverNowMs.set(Date.now() + this.serverOffsetMs());
      this.revisarPreparacionBackend();
      this.revisarFinAutomaticoIntervencion();
    }, 1000);

    this.refreshId = setInterval(() => {
      this.loadData(false);
    }, 60000);

    document.addEventListener('fullscreenchange', this.fullscreenHandler);

    this.iniciarSocketDashboard();
  }

  ngOnDestroy(): void {
    this.detenerTimers();

    this.realtime.off('reunion:updated');
    this.realtime.off('intervenciones:updated');
    this.realtime.off('dashboard:updated');
    this.realtime.off('tema:updated');
    this.realtime.off('participantes:updated');
    this.realtime.off('lugares:updated');
    this.realtime.off('votacion:updated');

    document.removeEventListener('fullscreenchange', this.fullscreenHandler);
    document.body.classList.remove('modo-presentacion');
    window.dispatchEvent(new Event('modo-presentacion-change'));
  }

  private iniciarSocketDashboard(): void {
    this.realtime.connect();

    this.realtime.on('reunion:updated', async () => {
      await this.loadData(false);
    });

    this.realtime.on('intervenciones:updated', async () => {
      await this.loadData(false);
    });

    this.realtime.on('dashboard:updated', async () => {
      await this.loadData(false);
    });

    this.realtime.on('tema:updated', async () => {
      await this.cargarTemaActual();
      await this.loadData(false);
    });

    this.realtime.on('participantes:updated', async () => {
      await this.loadData(false);
    });

    this.realtime.on('lugares:updated', async () => {
      await this.loadData(false);
    });

    this.realtime.on('votacion:updated', async () => {
      await this.cargarVotacion();
      await this.loadData(false);
    });
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

    if (this.votacionVisualizadorTimer) {
      clearTimeout(this.votacionVisualizadorTimer);
      this.votacionVisualizadorTimer = null;
    }
  }

  toggleMenuControl(): void {
    this.menuControlAbierto.update(v => !v);
  }

  cerrarMenuControl(): void {
    this.menuControlAbierto.set(false);
  }

  async toggleSonido(): Promise<void> {
    const nuevoEstado = !this.sonidoHabilitado();

    this.sonidoHabilitado.set(nuevoEstado);
    sessionStorage.setItem('sonidoDashboard', nuevoEstado ? '1' : '0');

    if (nuevoEstado) {
      await this.prepararAudioDashboard();
      this.reproducirSonidoIntervencion(true);
    }
  }

  private async prepararAudioDashboard(): Promise<void> {
    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.warn('No se pudo activar el sonido del Dashboard:', error);
    }
  }

  private reproducirSonidoIntervencion(forzar = false): void {
    if (!forzar && !this.sonidoHabilitado()) return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!this.audioContext) {
        this.audioContext = new AudioContextClass();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const ctx = this.audioContext;
      const ahora = ctx.currentTime;

      const crearNota = (inicio: number, frecuencia: number, duracion: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frecuencia, inicio);

        gain.gain.setValueAtTime(0.0001, inicio);
        gain.gain.exponentialRampToValueAtTime(0.28, inicio + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(inicio);
        osc.stop(inicio + duracion + 0.03);
      };

      crearNota(ahora, 740, 0.18);
      crearNota(ahora + 0.16, 988, 0.22);
    } catch (error) {
      console.warn('No se pudo reproducir el sonido de intervención:', error);
    }
  }

  private obtenerIdSonido(item: any): string | null {
    const id = item?.id ?? item?.intervencion_id ?? null;
    return id === null || id === undefined ? null : String(id);
  }

  private revisarSonidoIntervencion(actual: any, preparando: any, pendientes: any[]): void {
    const actualId = this.obtenerIdSonido(actual);
    const preparandoId = this.obtenerIdSonido(preparando);
    const colaIds = new Set(
      (pendientes || [])
        .map((item: any) => this.obtenerIdSonido(item))
        .filter((id: string | null): id is string => Boolean(id))
    );

    if (!this.sonidoMarcadoresInicializados) {
      this.ultimoActualSonidoId = actualId;
      this.ultimoPreparandoSonidoId = preparandoId;
      this.ultimosColaSonidoIds = colaIds;
      this.sonidoMarcadoresInicializados = true;
      return;
    }

    const hayNuevaIntervencionActual =
      Boolean(actualId) && actualId !== this.ultimoActualSonidoId;

    const hayNuevaPreparacion =
      Boolean(preparandoId) && preparandoId !== this.ultimoPreparandoSonidoId;

    const hayNuevaSolicitudEnCola = [...colaIds].some(
      id => !this.ultimosColaSonidoIds.has(id)
    );

    this.ultimoActualSonidoId = actualId;
    this.ultimoPreparandoSonidoId = preparandoId;
    this.ultimosColaSonidoIds = colaIds;

    if (
      this.sonidoHabilitado() &&
      (hayNuevaIntervencionActual || hayNuevaSolicitudEnCola)
    ) {
      this.reproducirSonidoIntervencion();
    }
  }

  private reiniciarMarcadoresSonido(): void {
    this.sonidoMarcadoresInicializados = false;
    this.ultimoActualSonidoId = null;
    this.ultimoPreparandoSonidoId = null;
    this.ultimosColaSonidoIds = new Set<string>();
  }

  async loadData(showLoading = true): Promise<void> {
    await this.cargarReunionActiva();

    if (this.reunionIniciada()) {
      await this.cargarTemaActual();
      await this.cargarIntervenciones();
      await this.cargarHistorial();
      await this.cargarVotacion();
    } else {
      this.temaActual.set(null);
      this.intervencionActual.set(null);
      this.cola.set([]);
      this.historial.set([]);
      this.votacion.set(null);
      this.resultadosVotacion.set({ si: 0, no: 0, abstencion: 0, total: 0 });
      this.configurarVisibilidadVotacionVisualizador(null);
      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();
      this.iniciandoAutomatico = false;
      this.finalizandoAutomatico = false;
      this.reiniciarMarcadoresSonido();
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
      intervenciones_automaticas: false,
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
    if (this.esVisualizador()) return;

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
    const res: any = await this.api.get('/dashboard/historial-intervenciones');

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
      const res: any = await this.api.get('/dashboard/intervenciones');

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const data = this.obtenerPayload(res) ?? [];
      const lista = Array.isArray(data) ? data : data.data ?? [];

      const visibles = lista.filter((item: any) =>
        ['aun no intervino', 'preparando', 'interviniendo'].includes(item.status)
      );

      const actual =
        visibles.find((item: any) => item.status === 'interviniendo') ?? null;

      const preparando =
        visibles.find((item: any) => item.status === 'preparando') ?? null;

      const pendientes = visibles
        .filter((item: any) => item.status === 'aun no intervino')
        .sort(
          (a: any, b: any) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

      this.sincronizarPausaConIntervencion(actual);

      this.intervencionActual.set(actual);
      this.cola.set(pendientes);
      this.revisarSonidoIntervencion(actual, preparando, pendientes);

      if (preparando) {
        this.preparando.set(true);
        this.participantePreparando.set(preparando);

        const prepMs = preparando?.preparacion_inicia_at
          ? new Date(preparando.preparacion_inicia_at).getTime()
          : NaN;

        this.preparacionIniciaAt.set(
          Number.isNaN(prepMs) ? null : prepMs
        );
      } else if (!this.iniciandoAutomatico) {
        this.limpiarPreparacion();
      }

      const reunion =
        actual?.participante?.reunion ??
        preparando?.participante?.reunion ??
        pendientes[0]?.participante?.reunion;

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
        !this.esVisualizador() &&
        this.intervencionesAutomaticas() &&
        !actual &&
        !preparando &&
        pendientes.length > 0 &&
        !this.preparando() &&
        !this.iniciandoAutomatico &&
        !this.finalizandoAutomatico
      ) {
        await this.prepararSiguiente(pendientes[0]);
        return;
      }

      if (!actual && !preparando && pendientes.length === 0 && !this.preparando()) {
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

    try {
      const res: any = await this.api.put(`/intervenciones/${siguiente.id}`, {
        status: 'preparando',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      const preparando = this.obtenerPayload(res);

      if (preparando?.id) {
        this.preparando.set(true);
        this.participantePreparando.set(preparando);

        const prepMs = preparando?.preparacion_inicia_at
          ? new Date(preparando.preparacion_inicia_at).getTime()
          : NaN;

        this.preparacionIniciaAt.set(
          Number.isNaN(prepMs) ? null : prepMs
        );
      }

      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error preparando intervención:', error);
    } finally {
      this.iniciandoAutomatico = false;
    }
  }

  private async iniciarIntervencionReal(item: any): Promise<void> {
    if (this.intervencionesPausadas()) return;
    if (!item?.id) return;

    this.iniciandoAutomatico = true;

    try {
      const res: any = await this.api.put(`/intervenciones/${item.id}`, {
        status: 'interviniendo',
      });

      this.sincronizarHoraServidor(this.obtenerServerNow(res));

      this.limpiarPreparacion();
      this.limpiarPausaIntervencion();

      await this.cargarIntervenciones();
      await this.cargarHistorial();
    } catch (error) {
      console.error('Error iniciando intervención:', error);

      this.limpiarPreparacion();
    } finally {
      this.iniciandoAutomatico = false;
    }
  }

  private async revisarPreparacionBackend(): Promise<void> {
    const preparando = this.participantePreparando();

    if (!this.reunionIniciada()) return;
    if (this.intervencionesPausadas()) return;
    if (!this.preparando() || !preparando?.id) return;
    if (this.iniciandoAutomatico) return;
    if (this.finalizandoAutomatico) return;
    if (this.segundosPreparacion() > 0) return;

    await this.iniciarIntervencionReal(preparando);
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
  }


  abrirModalVotacion(): void {
    if (this.esVisualizador()) return;

    if (!this.reunionIniciada()) {
      alert('Primero inicia una reunión.');
      return;
    }

    if (this.votacionActiva()) {
      alert('Ya hay una votación activa.');
      return;
    }

    this.incluirInvitadosVotacion.set(false);
    this.mostrarModalVotacion.set(true);
    this.cerrarMenuControl();
  }

  cerrarModalVotacion(): void {
    this.mostrarModalVotacion.set(false);
  }

  async iniciarVotacion(): Promise<void> {
    if (this.esVisualizador()) return;
    if (!this.reunionIniciada()) return;

    this.iniciandoVotacion.set(true);

    try {
      const res: any = await this.api.post('/votaciones/iniciar', {
        reunion_id: this.reunion()?.id,
        incluir_invitados: this.incluirInvitadosVotacion(),
      });

      const data = this.obtenerPayload(res);
      this.votacion.set(data?.votacion ?? data ?? null);
      this.resultadosVotacion.set(data?.resultados ?? { si: 0, no: 0, abstencion: 0, total: 0 });
      this.nombreVotacionGuardar.set('');
      this.mostrarModalVotacion.set(false);

      await this.cargarVotacion();
    } catch (error) {
      console.error('Error iniciando votación:', error);
      alert('No se pudo iniciar la votación.');
    } finally {
      this.iniciandoVotacion.set(false);
    }
  }

  async terminarVotacion(): Promise<void> {
    if (this.esVisualizador()) return;

    const votacion = this.votacion();

    if (!votacion?.id) {
      alert('No hay votación activa.');
      return;
    }

    if (!confirm('¿Terminar la votación y mostrar resultados?')) return;

    this.terminandoVotacion.set(true);

    try {
      const res: any = await this.api.post(`/votaciones/${votacion.id}/terminar`, {});
      const data = this.obtenerPayload(res);

      this.votacion.set(data?.votacion ?? data ?? null);
      this.resultadosVotacion.set(data?.resultados ?? { si: 0, no: 0, abstencion: 0, total: 0 });

      if (!this.nombreVotacionGuardar().trim()) {
        this.nombreVotacionGuardar.set(`Votación ${this.fechaActual()}`);
      }

      await this.cargarVotacion();
    } catch (error) {
      console.error('Error terminando votación:', error);
      alert('No se pudo terminar la votación.');
    } finally {
      this.terminandoVotacion.set(false);
      this.cerrarMenuControl();
    }
  }

  async guardarResultadoVotacion(): Promise<void> {
    if (this.esVisualizador()) return;

    const votacion = this.votacion();
    const nombre = this.nombreVotacionGuardar().trim();

    if (!votacion?.id) return;

    if (!nombre) {
      alert('Escribe un nombre para guardar la votación.');
      return;
    }

    this.guardandoVotacion.set(true);

    try {
      const res: any = await this.api.post(`/votaciones/${votacion.id}/guardar`, {
        nombre,
      });

      const data = this.obtenerPayload(res);

      this.votacion.set(data?.votacion ?? data ?? null);
      this.resultadosVotacion.set(data?.resultados ?? this.resultadosVotacion());
      alert('Resultado de votación guardado correctamente.');
    } catch (error) {
      console.error('Error guardando votación:', error);
      alert('No se pudo guardar el resultado de la votación.');
    } finally {
      this.guardandoVotacion.set(false);
    }
  }

  private async cargarVotacion(): Promise<void> {
    if (!this.reunionIniciada() || !this.reunion()?.id) {
      this.votacion.set(null);
      this.resultadosVotacion.set({ si: 0, no: 0, abstencion: 0, total: 0 });
      this.configurarVisibilidadVotacionVisualizador(null);
      return;
    }

    try {
      const res: any = await this.api.get('/votaciones/activa');
      const data = this.obtenerPayload(res);

      const votacion = data?.votacion ?? null;
      this.votacion.set(votacion);
      this.resultadosVotacion.set(data?.resultados ?? { si: 0, no: 0, abstencion: 0, total: 0 });
      this.configurarVisibilidadVotacionVisualizador(votacion);
    } catch (error) {
      console.error('Error cargando votación:', error);
      this.votacion.set(null);
      this.resultadosVotacion.set({ si: 0, no: 0, abstencion: 0, total: 0 });
      this.configurarVisibilidadVotacionVisualizador(null);
    }
  }

  private configurarVisibilidadVotacionVisualizador(votacion: any): void {
    if (!this.esVisualizador()) {
      this.mostrarResultadoVotacionVisualizador.set(true);
      return;
    }

    if (this.votacionVisualizadorTimer) {
      clearTimeout(this.votacionVisualizadorTimer);
      this.votacionVisualizadorTimer = null;
    }

    if (!votacion) {
      this.ultimaVotacionFinalizadaVisualizadorKey = '';
      this.mostrarResultadoVotacionVisualizador.set(true);
      return;
    }

    const status = String(votacion?.status || '').trim().toLowerCase();

    if (status === 'activa') {
      this.ultimaVotacionFinalizadaVisualizadorKey = '';
      this.mostrarResultadoVotacionVisualizador.set(true);
      return;
    }

    if (['finalizada', 'guardada'].includes(status)) {
      const key = `${votacion?.id || ''}-${status}-${votacion?.finalizada_at || votacion?.updated_at || ''}`;

      if (key !== this.ultimaVotacionFinalizadaVisualizadorKey) {
        this.ultimaVotacionFinalizadaVisualizadorKey = key;
        this.mostrarResultadoVotacionVisualizador.set(true);
      }

      this.votacionVisualizadorTimer = setTimeout(() => {
        this.mostrarResultadoVotacionVisualizador.set(false);
        this.votacionVisualizadorTimer = null;
      }, 7000);
    }
  }

  async togglePausaIntervenciones(): Promise<void> {
    if (this.esVisualizador()) return;

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
    await this.cargarIntervenciones();
    await this.cargarHistorial();
  }

  async finalizarIntervencion(): Promise<void> {
    if (this.esVisualizador()) return;

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
    if (!this.reunionIniciada()) {
      this.historialLocalItems = [];
      this.historial.set([]);
      return;
    }

    if (!this.esVisualizador() && !this.historialVisible()) {
      this.historialLocalItems = [];
      this.historial.set([]);
      return;
    }

    try {
      const histRes: any = await this.api.get('/dashboard/historial-intervenciones');

      const historialItems =
        histRes?.data?.data?.data ??
        histRes?.data?.data ??
        histRes?.data ??
        [];

      const lista = Array.isArray(historialItems) ? historialItems : [];

      const soloIntervenciones = lista
        .filter((item: any) => this.esHistorialIntervencionVisible(item))
        .filter((item: any) => {
          if (this.esVisualizador()) return true;
          if (!this.historialInicioId) return true;

          return Number(item.id || 0) > this.historialInicioId;
        })
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
    const dato = JSON.stringify(item?.dato ?? item ?? {}).toLowerCase();

    const texto = `${tabla} ${operacion} ${dato}`;

    const esIntervencion =
      tabla === 'intervenciones' ||
      tabla === 'intervencion' ||
      tabla.includes('intervencion') ||
      tabla.includes('intervención');

    const mencionaIntervencion =
      texto.includes('intervención') ||
      texto.includes('intervencion') ||
      texto.includes('participación') ||
      texto.includes('participacion') ||
      texto.includes('micrófono') ||
      texto.includes('microfono');

    const esActualizar =
      operacion === 'actualizar intervención' ||
      operacion === 'actualizar intervencion';

    if (this.esVisualizador()) {
      return (esIntervencion || mencionaIntervencion) && !esActualizar;
    }

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
    if (this.esVisualizador()) return;

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
    if (this.esVisualizador()) return;

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

      this.mostrarHistorialIntervenciones.set(false);
      sessionStorage.removeItem('mostrarHistorialDashboard');

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
    if (this.esVisualizador()) return;

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

      this.mostrarHistorialIntervenciones.set(false);
      sessionStorage.removeItem('mostrarHistorialDashboard');

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


  async toggleIntervencionesAutomaticas(): Promise<void> {
    if (this.esVisualizador()) return;

    const reunion = this.reunion();

    if (!reunion?.id || !this.reunionIniciada()) {
      alert('No hay reunión activa.');
      return;
    }

    try {
      const res: any = await this.api.post(
        `/reuniones/${reunion.id}/toggle-intervenciones-automaticas`,
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
      }

      await this.cargarIntervenciones();
    } catch (error) {
      console.error('Error cambiando intervenciones automáticas:', error);
      alert('No se pudo cambiar el estado de intervenciones automáticas.');
    }
  }

  async iniciarIntervencionManual(item: any): Promise<void> {
    if (this.esVisualizador()) return;

    if (!item?.id) return;

    if (this.intervencionesPausadas()) {
      alert('Las intervenciones están pausadas.');
      return;
    }

    if (this.intervencionActual()) {
      alert('Ya existe una intervención activa.');
      return;
    }

    if (this.preparando()) {
      alert('Ya hay una intervención en preparación.');
      return;
    }

    await this.prepararSiguiente(item);
  }

  toggleHistorialIntervenciones(): void {
    this.mostrarHistorialIntervenciones.update(valor => !valor);

    if (this.mostrarHistorialIntervenciones()) {
      sessionStorage.setItem('mostrarHistorialDashboard', '1');
      this.cargarHistorial();
      return;
    }

    sessionStorage.removeItem('mostrarHistorialDashboard');
    this.historialLocalItems = [];
    this.historial.set([]);
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
