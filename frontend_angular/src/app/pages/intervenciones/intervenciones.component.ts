import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-intervenciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './intervenciones.component.html',
})
export class IntervencionesComponent implements OnInit, OnDestroy {
  allItems = signal<any[]>([]);
  historialItems = signal<any[]>([]);
  reuniones = signal<any[]>([]);

  loading = signal(false);
  error = signal('');

  qHistorial = '';
  filtroReunion = '';

  private refreshId: any = null;

  items = computed(() => {
    return this.allItems()
      .filter(item => ['aun no intervino', 'interviniendo'].includes(item.status))
      .sort((a, b) => {
        const order: Record<string, number> = {
          interviniendo: 1,
          'aun no intervino': 2,
        };

        const statusA = order[a.status] ?? 99;
        const statusB = order[b.status] ?? 99;

        if (statusA !== statusB) return statusA - statusB;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  });

  intervencionActual = computed(() => {
    return this.items().find(item => item.status === 'interviniendo') ?? null;
  });

  cola = computed(() => {
    return this.items().filter(item => item.status === 'aun no intervino');
  });

  proxima = computed(() => {
    return this.cola()[0] ?? null;
  });

  historialFiltrado = computed(() => {
    const search = this.qHistorial.trim().toLowerCase();
    const reunion = this.filtroReunion;

    return this.historialItems().filter(item => {
      const nombre = this.nombreHistorialIntervencion(item).toLowerCase();
      const op = String(item.operacion || '').toLowerCase();
      const reunionTexto = this.reunionHistorial(item).toLowerCase();
      const fecha = String(item.created_at || '').toLowerCase();

      const matchesSearch =
        !search ||
        nombre.includes(search) ||
        op.includes(search) ||
        reunionTexto.includes(search) ||
        fecha.includes(search);

      const matchesReunion = !reunion || this.reunionHistorial(item) === reunion;

      return matchesSearch && matchesReunion;
    });
  });

  reunionesHistorial = computed(() => {
    const set = new Set<string>();

    this.historialItems().forEach(item => {
      const reunion = this.reunionHistorial(item);
      if (reunion && reunion !== 'Sin reunión') set.add(reunion);
    });

    return Array.from(set).sort();
  });

  totalCola = computed(() => this.cola().length);
  totalHistorial = computed(() => this.historialItems().length);

  reunionesActivas = computed(() => {
    return this.items().filter(item => item?.participante?.reunion?.status === 'activa').length;
  });

  reunionesNoActivas = computed(() => {
    return this.items().filter(item => item?.participante?.reunion?.status !== 'activa').length;
  });

  miembros = computed(() => {
    return this.items().filter(item => item?.participante?.miembro).length;
  });

  invitados = computed(() => {
    return this.items().filter(item => item?.participante?.invitado).length;
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();

    this.refreshId = setInterval(() => {
      this.cargarIntervenciones(false);
    }, 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshId);
  }

  async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.error.set('');

    try {
      await Promise.all([
        this.cargarReuniones(),
        this.cargarIntervenciones(false),
        this.cargarHistorialCompleto(),
      ]);
    } catch (error) {
      console.error('Error cargando intervenciones:', error);
      this.error.set('No se pudieron cargar las intervenciones.');
    } finally {
      this.loading.set(false);
    }
  }

  async cargarReuniones(): Promise<void> {
    try {
      const res: any = await this.api.get('/reuniones');
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      this.reuniones.set(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando reuniones:', error);
      this.reuniones.set([]);
    }
  }

  async cargarIntervenciones(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);

    try {
      const res: any = await this.api.get('/intervenciones');
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      this.allItems.set(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando cola de intervenciones:', error);
      this.allItems.set([]);
    } finally {
      if (showLoading) this.loading.set(false);
    }
  }

  async cargarHistorialCompleto(): Promise<void> {
    const acumulado: any[] = [];

    const firstRes: any = await this.api.get('/historial?page=1');
    const firstPaginator = this.extraerPaginador(firstRes);

    acumulado.push(...this.extraerDataPaginada(firstPaginator));

    const lastPage = Number(firstPaginator?.last_page || 1);

    for (let page = 2; page <= lastPage; page++) {
      const res: any = await this.api.get(`/historial?page=${page}`);
      const paginator = this.extraerPaginador(res);
      acumulado.push(...this.extraerDataPaginada(paginator));
    }

    const historialIntervenciones = acumulado
      .filter(item => this.esHistorialIntervencionVisible(item))
      .map(item => ({
        ...item,
        participante_nombre: this.extraerNombreHistorial(item),
        reunion_nombre: this.reunionHistorial(item),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    this.historialItems.set(historialIntervenciones);
  }

  limpiarFiltrosHistorial(): void {
    this.qHistorial = '';
    this.filtroReunion = '';
  }

  private esHistorialIntervencionVisible(item: any): boolean {
    const tabla = String(item?.tabla || '').toLowerCase();
    const operacion = String(item?.operacion || '').toLowerCase();

    const esIntervencion = tabla === 'intervenciones';
    const mencionaIntervencion =
      operacion.includes('intervención') || operacion.includes('intervencion');

    const esActualizar =
      operacion === 'actualizar intervención' ||
      operacion === 'actualizar intervencion';

    return esIntervencion && mencionaIntervencion && !esActualizar;
  }

  private extraerPaginador(res: any): any {
    const body = res?.data ?? res ?? {};
    return body?.data?.current_page ? body.data : body?.current_page ? body : body?.data ?? {};
  }

  private extraerDataPaginada(paginator: any): any[] {
    const data = paginator?.data ?? [];
    return Array.isArray(data) ? data : [];
  }

  nombreParticipante(item: any): string {
    return (
      item?.participante?.miembro?.nombre ||
      item?.participante?.invitado?.nombre ||
      'Sin participante'
    );
  }

  tipoParticipante(item: any): string {
    if (item?.participante?.miembro) return 'Miembro';
    if (item?.participante?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(item: any): string {
    return item?.participante?.miembro?.rfid || 'Sin RFID';
  }

  nombreReunion(item: any): string {
    return item?.participante?.reunion?.sesion || 'Sin reunión';
  }

  estadoReunion(item: any): string {
    return item?.participante?.reunion?.status || 'sin estado';
  }

  fechaReunion(item: any): string {
    return this.formatDate(item?.participante?.reunion?.fecha);
  }

  horaReunion(item: any): string {
    const inicio = item?.participante?.reunion?.hora_inicio;
    const fin = item?.participante?.reunion?.hora_fin;

    if (!inicio && !fin) return 'Sin horario';

    return `${this.formatTime(inicio)} - ${this.formatTime(fin)}`;
  }

  nombreHistorialIntervencion(item: any): string {
    return item?.participante_nombre || this.extraerNombreHistorial(item);
  }

  private extraerNombreHistorial(item: any): string {
    if (typeof item?.dato?.participante === 'string') return item.dato.participante;

    return (
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

  reunionHistorial(item: any): string {
    const nombreDirecto =
      item?.reunion_nombre ||
      item?.dato?.reunion ||
      item?.dato?.reunion_nombre ||
      item?.dato?.despues?.reunion?.sesion ||
      item?.dato?.antes?.reunion?.sesion;

    if (nombreDirecto && !String(nombreDirecto).toLowerCase().startsWith('reunión id')) {
      return nombreDirecto;
    }

    const reunionId =
      item?.dato?.reunion_id ||
      item?.dato?.despues?.reunion_id ||
      item?.dato?.antes?.reunion_id;

    if (reunionId) {
      const reunion = this.reuniones().find(
        r => String(r.id) === String(reunionId)
      );

      return reunion?.sesion || `Reunión ${reunionId}`;
    }

    return 'Sin reunión';
  }

  accionHistorial(item: any): string {
    return item?.operacion || 'Acción de intervención';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      'aun no intervino': 'En cola',
      interviniendo: 'Interviniendo',
      'fin intervencion': 'Finalizada',
    };

    return labels[status] || status || 'Sin estado';
  }

  statusClass(status: string): string {
    const classes: Record<string, string> = {
      'aun no intervino': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      interviniendo: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      'fin intervencion': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  operacionHistorialClass(operacion: string): string {
    const op = String(operacion || '').toLowerCase();

    if (op.includes('solicitud')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }

    if (op.includes('cancelar') || op.includes('cancelada')) {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300';
    }

    if (op.includes('finalizar') || op.includes('finalizada')) {
      return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
    }

    return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  }

  reunionClass(status: string): string {
    const classes: Record<string, string> = {
      activa: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      pospuesta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      terminada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cancelada: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  reunionLabel(status: string): string {
    const labels: Record<string, string> = {
      activa: 'Activa',
      pospuesta: 'Pospuesta',
      terminada: 'Terminada',
      cancelada: 'Cancelada',
    };

    return labels[status] || status || 'Sin estado';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');

    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
  }

  formatTime(hora: string): string {
    if (!hora) return 'Sin hora';
    return hora.toString().slice(0, 5);
  }

  formatDateTime(fecha: string): string {
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