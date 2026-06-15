import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-invitados',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './invitados.component.html',
})
export class InvitadosComponent implements OnInit {
  allItems = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  q = '';

  modal = false;
  editing: any = null;

  form: any = this.emptyForm();

  invitados = computed(() => {
    const search = this.q.trim().toLowerCase();

    return this.allItems()
      .filter(item => {
        const nombre = String(item.nombre || '').toLowerCase();
        const fecha = String(item.fecha_participacion || '').toLowerCase();

        return !search || nombre.includes(search) || fecha.includes(search);
      })
      .sort((a, b) => {
        const fechaA = a.fecha_participacion || '9999-12-31';
        const fechaB = b.fecha_participacion || '9999-12-31';

        if (fechaA !== fechaB) {
          return fechaA.localeCompare(fechaB);
        }

        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
      });
  });

  total = computed(() => this.allItems().length);

  hoy = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.allItems().filter(i => i.fecha_participacion === today).length;
  });

  proximos = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.allItems().filter(i => i.fecha_participacion >= today).length;
  });

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/invitados');
      this.allItems.set(this.normalizarRespuesta(res));
    } catch (error) {
      console.error('Error cargando invitados:', error);
      this.error.set('No se pudieron cargar los invitados.');
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
          nombre: item.nombre || '',
          fecha_participacion:
            item.fecha_participacion || new Date().toISOString().slice(0, 10),
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
    if (!this.form.nombre || !this.form.fecha_participacion) {
      this.error.set('Completa nombre y fecha de participación.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      nombre: this.form.nombre,
      fecha_participacion: this.form.fecha_participacion,
    };

    try {
      if (this.editing) {
        await this.api.put(`/invitados/${this.editing.id}`, payload);
      } else {
        await this.api.post('/invitados', payload);
      }

      this.close();
      await this.load();
    } catch (error: any) {
      console.error('Error guardando invitado:', error);
      this.error.set(this.extractError(error) || 'No se pudo guardar el invitado.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: number): Promise<void> {
    if (!confirm('¿Seguro que deseas eliminar este invitado?')) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/invitados/${id}`);
      await this.load();
    } catch (error: any) {
      console.error('Error eliminando invitado:', error);
      this.error.set(this.extractError(error) || 'No se pudo eliminar el invitado.');
    } finally {
      this.loading.set(false);
    }
  }

  limpiarBusqueda(): void {
    this.q = '';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  private emptyForm(): any {
    return {
      nombre: '',
      fecha_participacion: new Date().toISOString().slice(0, 10),
    };
  }

  private normalizarRespuesta(res: any): any[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];
    return Array.isArray(data) ? data : [];
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