import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-reuniones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reuniones.component.html',
})
export class ReunionesComponent implements OnInit {
  allItems = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);
  error = signal('');

  q = '';
  filtroStatus = '';

  modal = false;
  editing: any = null;
  form: any = this.emptyForm();

  detalleModal = false;
  detalleReunion: any = null;
  loadingDetalle = signal(false);

  temasModal = false;
  reunionTemas: any = null;
  temas = signal<any[]>([]);
  loadingTemas = signal(false);
  savingTema = signal(false);
  temaForm: any = this.emptyTemaForm();

  participantesModal = false;
  reunionParticipantes: any = null;
  participantesVersion = signal(0);
  miembros = signal<any[]>([]);
  invitados = signal<any[]>([]);
  loadingParticipantes = signal(false);
  savingParticipante = signal(false);
  savingTodosMiembros = signal(false);
  participanteForm: any = this.emptyParticipanteForm();

  estados = [
    { value: '', label: 'Todos' },
    { value: 'programada', label: 'Programada' },
    { value: 'activa', label: 'Activa' },
    { value: 'terminada', label: 'Terminada' },
    { value: 'cancelada', label: 'Cancelada' },
    { value: 'pospuesta', label: 'Pospuesta' },
  ];

  items = computed(() => {
    const search = this.q.trim().toLowerCase();
    const status = this.filtroStatus;

    return this.allItems().filter(item => {
      const sesion = String(item.sesion || '').toLowerCase();
      const fecha = String(item.fecha || '').toLowerCase();
      const estado = String(item.status || '').toLowerCase();
      const inicioPrevisto = String(item.hora_inicio || '').toLowerCase();
      const finPrevisto = String(item.hora_fin || '').toLowerCase();
      const inicioReal = String(item.inicio_real_at || '').toLowerCase();
      const finReal = String(item.fin_real_at || '').toLowerCase();

      const matchesSearch =
        !search ||
        sesion.includes(search) ||
        fecha.includes(search) ||
        estado.includes(search) ||
        inicioPrevisto.includes(search) ||
        finPrevisto.includes(search) ||
        inicioReal.includes(search) ||
        finReal.includes(search);

      const matchesStatus = !status || item.status === status;

      return matchesSearch && matchesStatus;
    });
  });

  total = computed(() => this.allItems().length);
  programadas = computed(() => this.allItems().filter(i => i.status === 'programada').length);
  activas = computed(() => this.allItems().filter(i => i.status === 'activa').length);
  terminadas = computed(() => this.allItems().filter(i => i.status === 'terminada').length);
  canceladas = computed(() => this.allItems().filter(i => i.status === 'cancelada').length);

  temasPendientes = computed(() =>
    this.temas().filter(tema => tema.status === 'pendiente')
  );

  temasEnCurso = computed(() =>
    this.temas().filter(tema => tema.status === 'en_curso')
  );

  temasCompletados = computed(() =>
    this.temas().filter(tema => tema.status === 'completado')
  );

  participantesReunion = computed(() => {
    this.participantesVersion();
    return this.reunionParticipantes?.participantes ?? [];
  });

  miembrosDisponibles = computed(() => {
    const usados = new Set(
      this.participantesReunion()
        .map((participante: any) => Number(participante?.miembro_id || participante?.miembro?.id || 0))
        .filter((id: number) => id > 0)
    );

    return this.miembros().filter((miembro: any) => !usados.has(Number(miembro.id)));
  });

  invitadosDisponibles = computed(() => {
    const usados = new Set(
      this.participantesReunion()
        .map((participante: any) => Number(participante?.invitado_id || participante?.invitado?.id || 0))
        .filter((id: number) => id > 0)
    );

    return this.invitados().filter((invitado: any) => !usados.has(Number(invitado.id)));
  });

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/reuniones');
      this.allItems.set(this.normalizarRespuesta(res));
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar las reuniones.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  open(item?: any): void {
    this.error.set('');
    this.editing = item || null;

    if (item) {
      this.form = {
        sesion: item.sesion || '',
        fecha: this.toInputDate(item.fecha),
        status: item.status || 'programada',
        hora_inicio: this.toInputTime(item.hora_inicio),
        hora_fin: this.toInputTime(item.hora_fin),
      };
    } else {
      this.form = this.emptyForm();
    }

    this.modal = true;
  }

  close(): void {
    this.modal = false;
    this.editing = null;
    this.form = this.emptyForm();
    this.error.set('');
  }

  async save(): Promise<void> {
    if (!this.form.sesion?.trim()) {
      this.error.set('Escribe el nombre de la sesión.');
      return;
    }

    if (!this.form.fecha) {
      this.error.set('Selecciona la fecha.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      sesion: this.form.sesion.trim(),
      fecha: this.form.fecha,
      status: this.form.status || 'programada',
      hora_inicio: this.form.hora_inicio || null,
      hora_fin: this.form.hora_fin || null,
    };

    try {
      if (this.editing) {
        await this.api.put(`/reuniones/${this.editing.id}`, payload);
      } else {
        await this.api.post('/reuniones', payload);
      }

      this.close();
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo guardar la reunión.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: number): Promise<void> {
    if (!confirm('¿Seguro que deseas eliminar esta reunión?')) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/reuniones/${id}`);
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo eliminar la reunión.');
    } finally {
      this.loading.set(false);
    }
  }

  async verDetalle(item: any): Promise<void> {
    this.loadingDetalle.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get(`/reuniones/${item.id}`);

      this.detalleReunion =
        res?.data?.data ??
        res?.data ??
        res;

      this.detalleModal = true;
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo cargar el detalle de la reunión.');
    } finally {
      this.loadingDetalle.set(false);
    }
  }

  cerrarDetalle(): void {
    this.detalleModal = false;
    this.detalleReunion = null;
  }

  async abrirParticipantes(item: any): Promise<void> {
    this.error.set('');
    this.reunionParticipantes = null;
    this.participantesVersion.update(v => v + 1);
    this.participanteForm = this.emptyParticipanteForm();
    this.participantesModal = true;

    await Promise.all([
      this.cargarCatalogosParticipantes(),
      this.cargarDetalleParticipantes(item.id),
    ]);
  }

  cerrarParticipantes(): void {
    this.participantesModal = false;
    this.reunionParticipantes = null;
    this.participantesVersion.update(v => v + 1);
    this.participanteForm = this.emptyParticipanteForm();
    this.error.set('');
  }

  async cargarCatalogosParticipantes(): Promise<void> {
    try {
      const [miembrosRes, invitadosRes]: any[] = await Promise.all([
        this.api.get('/miembros'),
        this.api.get('/invitados'),
      ]);

      this.miembros.set(this.normalizarRespuesta(miembrosRes));
      this.invitados.set(this.normalizarRespuesta(invitadosRes));
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar miembros e invitados.');
      this.miembros.set([]);
      this.invitados.set([]);
    }
  }

  async cargarDetalleParticipantes(reunionId: number): Promise<void> {
    this.loadingParticipantes.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get(`/reuniones/${reunionId}`);

      this.reunionParticipantes =
        res?.data?.data ??
        res?.data ??
        res;

      this.participantesVersion.update(v => v + 1);

      if (this.detalleReunion?.id === this.reunionParticipantes?.id) {
        this.detalleReunion = this.reunionParticipantes;
      }
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar los participantes de la reunión.');
      this.reunionParticipantes = null;
      this.participantesVersion.update(v => v + 1);
    } finally {
      this.loadingParticipantes.set(false);
    }
  }

  async agregarParticipanteReunion(): Promise<void> {
    if (!this.reunionParticipantes?.id) {
      this.error.set('No hay una reunión seleccionada.');
      return;
    }

    const tipo = this.participanteForm.tipo;
    const miembroId = Number(this.participanteForm.miembro_id || 0);
    const invitadoId = Number(this.participanteForm.invitado_id || 0);

    if (tipo === 'miembro' && !miembroId) {
      this.error.set('Selecciona un miembro.');
      return;
    }

    if (tipo === 'invitado' && !invitadoId) {
      this.error.set('Selecciona un invitado.');
      return;
    }

    this.savingParticipante.set(true);
    this.error.set('');

    const payload: any = {
      reunion_id: this.reunionParticipantes.id,
      status: 'presente',
      miembro_id: tipo === 'miembro' ? miembroId : null,
      invitado_id: tipo === 'invitado' ? invitadoId : null,
    };

    try {
      await this.api.post('/participantes', payload);
      this.participanteForm = this.emptyParticipanteForm();
      await this.cargarDetalleParticipantes(this.reunionParticipantes.id);
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo agregar el participante.');
    } finally {
      this.savingParticipante.set(false);
    }
  }

  async agregarTodosMiembros(): Promise<void> {
    if (!this.reunionParticipantes?.id) {
      this.error.set('No hay una reunión seleccionada.');
      return;
    }

    if (!confirm('¿Seguro que deseas agregar todos los miembros disponibles a esta reunión? No se agregarán invitados.')) {
      return;
    }

    this.savingTodosMiembros.set(true);
    this.error.set('');

    try {
      await this.api.post(`/reuniones/${this.reunionParticipantes.id}/participantes/agregar-miembros`, {});
      await this.cargarDetalleParticipantes(this.reunionParticipantes.id);
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron agregar todos los miembros.');
    } finally {
      this.savingTodosMiembros.set(false);
    }
  }

  async eliminarParticipanteReunion(participante: any): Promise<void> {
    if (!confirm(`¿Seguro que deseas quitar a "${this.nombreParticipante(participante)}" de esta reunión?`)) {
      return;
    }

    this.loadingParticipantes.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/participantes/${participante.id}`);

      if (this.reunionParticipantes?.id) {
        await this.cargarDetalleParticipantes(this.reunionParticipantes.id);
      }

      if (this.detalleReunion?.id) {
        const res: any = await this.api.get(`/reuniones/${this.detalleReunion.id}`);
        this.detalleReunion = res?.data?.data ?? res?.data ?? res;
      }

      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo quitar el participante.');
    } finally {
      this.loadingParticipantes.set(false);
    }
  }

  async abrirTemas(item: any): Promise<void> {
    this.error.set('');
    this.reunionTemas = item;
    this.temaForm = this.emptyTemaForm();
    this.temas.set([]);
    this.temasModal = true;

    await this.cargarTemas(item.id);
  }

  cerrarTemas(): void {
    this.temasModal = false;
    this.reunionTemas = null;
    this.temas.set([]);
    this.temaForm = this.emptyTemaForm();
    this.error.set('');
  }

  async cargarTemas(reunionId: number): Promise<void> {
    this.loadingTemas.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get(`/temas-reunion?reunion_id=${reunionId}`);
      this.temas.set(this.normalizarRespuesta(res));
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar los temas de la reunión.');
      this.temas.set([]);
    } finally {
      this.loadingTemas.set(false);
    }
  }

  async agregarTema(): Promise<void> {
    if (!this.reunionTemas?.id) {
      this.error.set('No hay una reunión seleccionada.');
      return;
    }

    if (!this.temaForm.titulo?.trim()) {
      this.error.set('Escribe el título del tema.');
      return;
    }

    this.savingTema.set(true);
    this.error.set('');

    const payload = {
      reunion_id: this.reunionTemas.id,
      titulo: this.temaForm.titulo.trim(),
      descripcion: this.temaForm.descripcion?.trim() || null,
    };

    try {
      await this.api.post('/temas-reunion', payload);
      this.temaForm = this.emptyTemaForm();
      await this.cargarTemas(this.reunionTemas.id);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo agregar el tema.');
    } finally {
      this.savingTema.set(false);
    }
  }

  async eliminarTema(tema: any): Promise<void> {
    if (!confirm(`¿Seguro que deseas eliminar el tema "${tema.titulo}"?`)) return;

    this.loadingTemas.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/temas-reunion/${tema.id}`);

      if (this.reunionTemas?.id) {
        await this.cargarTemas(this.reunionTemas.id);
      }
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo eliminar el tema.');
    } finally {
      this.loadingTemas.set(false);
    }
  }

  async reiniciarTemas(): Promise<void> {
    if (!this.reunionTemas?.id) return;

    if (!confirm('¿Seguro que deseas reiniciar todos los temas como pendientes?')) return;

    this.loadingTemas.set(true);
    this.error.set('');

    try {
      await this.api.post(`/reuniones/${this.reunionTemas.id}/temas/reiniciar`, {});
      await this.cargarTemas(this.reunionTemas.id);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron reiniciar los temas.');
    } finally {
      this.loadingTemas.set(false);
    }
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroStatus = '';
  }

  participantesDetalle(): any[] {
    return this.detalleReunion?.participantes ?? [];
  }

  intervencionesDetalle(): any[] {
    const participantes = this.participantesDetalle();

    return participantes.flatMap((participante: any) => {
      const intervenciones =
        participante?.intervenciones ?? [];

      return intervenciones.map((intervencion: any) => ({
        ...intervencion,
        participante,
      }));
    });
  }

  nombreParticipante(participante: any): string {
    return participante?.miembro?.nombre ||
      participante?.invitado?.nombre ||
      'Participante sin nombre';
  }

  tipoParticipante(participante: any): string {
    if (participante?.miembro) return 'Miembro';
    if (participante?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(participante: any): string {
    return participante?.miembro?.rfid || 'Sin RFID';
  }

  badgeClass(status: string): string {
    const classes: Record<string, string> = {
      programada: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      activa: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      terminada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cancelada: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      pospuesta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      programada: 'Programada',
      activa: 'Activa',
      terminada: 'Terminada',
      cancelada: 'Cancelada',
      pospuesta: 'Pospuesta',
    };

    return labels[status] || status || 'Sin estado';
  }

  temaBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      en_curso: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      completado: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  temaStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pendiente: 'Pendiente',
      en_curso: 'En curso',
      completado: 'Completado',
    };

    return labels[status] || status || 'Sin estado';
  }

  participanteBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      presente: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      ausente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      retirado: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  participanteStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      presente: 'Presente',
      ausente: 'Ausente',
      retirado: 'Retirado',
    };

    return labels[status] || status || 'Sin estado';
  }

  intervencionBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'aun no intervino': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      interviniendo: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      'fin intervencion': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  formatDate(fecha: string | null | undefined): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  formatTime(hora: string | null | undefined): string {
    if (!hora) return '--:--';

    const partes = hora.toString().split(':');
    if (partes.length >= 2) {
      return `${partes[0]}:${partes[1]}`;
    }

    return hora;
  }

  formatDateTime(fecha: string | null | undefined): string {
    if (!fecha) return '--:--';

    const date = new Date(fecha);

    if (isNaN(date.getTime())) {
      return fecha;
    }

    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  private toInputDate(fecha: string | null | undefined): string {
    if (!fecha) return '';
    return fecha.toString().split('T')[0];
  }

  private toInputTime(hora: string | null | undefined): string {
    if (!hora) return '';

    const partes = hora.toString().split(':');
    if (partes.length >= 2) {
      return `${partes[0]}:${partes[1]}`;
    }

    return hora;
  }

  private emptyForm(): any {
    return {
      sesion: '',
      fecha: new Date().toISOString().slice(0, 10),
      status: 'programada',
      hora_inicio: '',
      hora_fin: '',
    };
  }

  private emptyTemaForm(): any {
    return {
      titulo: '',
      descripcion: '',
    };
  }

  private emptyParticipanteForm(): any {
    return {
      tipo: 'miembro',
      miembro_id: '',
      invitado_id: '',
    };
  }

  private normalizarRespuesta(res: any): any[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];
    return Array.isArray(data) ? data : [];
  }

  private extractError(error: any): string {
    const data = error?.response?.data ?? error?.data ?? error;

    if (data?.message) return data.message;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      return data.errors[firstKey]?.[0] || 'Error de validación.';
    }

    return '';
  }
}