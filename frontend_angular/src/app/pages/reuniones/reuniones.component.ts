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

  const statusOrder: Record<string, number> = {
    activa: 1,
    pospuesta: 2,
    terminada: 3,
    cancelada: 4,
  };

  return this.allItems()
    .filter(item => {
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
    })
    .sort((a, b) => {
      const statusA = statusOrder[a.status] ?? 99;
      const statusB = statusOrder[b.status] ?? 99;

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      const fechaA = a.fecha || '9999-12-31';
      const fechaB = b.fecha || '9999-12-31';

      if (fechaA !== fechaB) {
        return fechaA.localeCompare(fechaB);
      }

      const horaA = a.hora_inicio || '99:99:99';
      const horaB = b.hora_inicio || '99:99:99';

      return horaA.localeCompare(horaB);
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

      const data =
        res?.data?.data ??
        res?.data ??
        res ??
        [];

      this.allItems.set(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando reuniones:', error);
      this.error.set('No se pudieron cargar las reuniones.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  open(item?: any): void {
    this.error.set('');
    this.editing = item || null;

    this.form = item
      ? {
          sesion: item.sesion || '',
          fecha: item.fecha || '',
          status: item.status || 'activa',
          hora_inicio: this.toInputTime(item.hora_inicio),
          hora_fin: this.toInputTime(item.hora_fin),
        }
      : this.emptyForm();

    this.modal = true;
  }

  close(): void {
    this.modal = false;
    this.editing = null;
    this.form = this.emptyForm();
    this.error.set('');
  }

  async save(): Promise<void> {
    if (!this.form.sesion || !this.form.fecha || !this.form.status) {
      this.error.set('Completa sesión, fecha y estado.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      sesion: this.form.sesion,
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
      console.error('Error guardando reunión:', error);
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
      console.error('Error eliminando reunión:', error);
      this.error.set(this.extractError(error) || 'No se pudo eliminar la reunión.');
    } finally {
      this.loading.set(false);
    }
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroStatus = '';
  }

  badgeClass(status: string): string {
    const classes: Record<string, string> = {
      activa: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      terminada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cancelada: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      pospuesta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
    };

    return classes[status] || classes['terminada'];
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

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');

    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  formatTime(hora: string): string {
    if (!hora) return 'Sin hora';
    return hora.toString().slice(0, 5);
  }

  private toInputTime(hora: string): string {
    if (!hora) return '';
    return hora.toString().slice(0, 5);
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

  private extractError(error: any): string {
    const data = error?.response?.data;

    if (data?.message) return data.message;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      return data.errors[firstKey]?.[0] || 'Error de validación.';
    }

    return '';
  }
}