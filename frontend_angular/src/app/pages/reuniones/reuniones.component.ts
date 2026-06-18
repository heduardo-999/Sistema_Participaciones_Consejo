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

  estados = [
    { value: '', label: 'Todos' },
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

      const matchesSearch =
        !search ||
        sesion.includes(search) ||
        fecha.includes(search) ||
        estado.includes(search);

      const matchesStatus = !status || item.status === status;

      return matchesSearch && matchesStatus;
    });
  });

  total = computed(() => this.allItems().length);
  activas = computed(() => this.allItems().filter(i => i.status === 'activa').length);
  terminadas = computed(() => this.allItems().filter(i => i.status === 'terminada').length);
  canceladas = computed(() => this.allItems().filter(i => i.status === 'cancelada').length);

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
        status: item.status || 'activa',
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
      status: this.form.status,
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
      const intervenciones = participante?.intervenciones ?? [];

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
      activa: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      terminada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cancelada: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      pospuesta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      activa: 'Activa',
      terminada: 'Terminada',
      cancelada: 'Cancelada',
      pospuesta: 'Pospuesta',
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

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  formatTime(hora: string): string {
    if (!hora) return '--:--';

    const partes = hora.toString().split(':');
    if (partes.length >= 2) {
      return `${partes[0]}:${partes[1]}`;
    }

    return hora;
  }

  private toInputDate(fecha: string): string {
    if (!fecha) return '';
    return fecha.toString().split('T')[0];
  }

  private toInputTime(hora: string): string {
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
      status: 'activa',
      hora_inicio: '',
      hora_fin: '',
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