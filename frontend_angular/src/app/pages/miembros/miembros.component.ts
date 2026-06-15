import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-miembros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './miembros.component.html',
})
export class MiembrosComponent implements OnInit {
  allItems = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  q = '';
  filtroBaja = '';

  modal = false;
  editing: any = null;

  form: any = this.emptyForm();

  miembros = computed(() => {
    const search = this.q.trim().toLowerCase();
    const baja = this.filtroBaja;

    return this.allItems()
      .filter(item => {
        const nombre = String(item.nombre || '').toLowerCase();
        const rfid = String(item.rfid || '').toLowerCase();
        const fecha = String(item.fecha || '').toLowerCase();
        const estado = this.estadoLabel(item.baja).toLowerCase();

        const matchesSearch =
          !search ||
          nombre.includes(search) ||
          rfid.includes(search) ||
          fecha.includes(search) ||
          estado.includes(search);

        const matchesBaja = baja === '' || String(item.baja) === String(baja);

        return matchesSearch && matchesBaja;
      })
      .sort((a, b) => {
        if (Number(a.baja) !== Number(b.baja)) {
          return Number(a.baja) - Number(b.baja);
        }

        return String(a.nombre || '').localeCompare(String(b.nombre || ''));
      });
  });

  total = computed(() => this.allItems().length);
  activos = computed(() => this.allItems().filter(i => Number(i.baja) === 0).length);
  bajas = computed(() => this.allItems().filter(i => Number(i.baja) === 1).length);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/miembros');
      this.allItems.set(this.normalizarRespuesta(res));
    } catch (error) {
      console.error('Error cargando miembros:', error);
      this.error.set('No se pudieron cargar los miembros.');
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
          fecha: item.fecha || new Date().toISOString().slice(0, 10),
          rfid: item.rfid || '',
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
    if (!this.form.nombre || !this.form.fecha || !this.form.rfid) {
      this.error.set('Completa nombre, fecha y RFID.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      nombre: this.form.nombre,
      fecha: this.form.fecha,
      rfid: this.form.rfid,
    };

    try {
      if (this.editing) {
        await this.api.put(`/miembros/${this.editing.id}`, payload);
      } else {
        await this.api.post('/miembros', payload);
      }

      this.close();
      await this.load();
    } catch (error: any) {
      console.error('Error guardando miembro:', error);
      this.error.set(this.extractError(error) || 'No se pudo guardar el miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  async darBaja(item: any): Promise<void> {
    if (!confirm(`¿Dar de baja a ${item.nombre}?`)) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/miembros/${item.id}`);
      await this.load();
    } catch (error: any) {
      console.error('Error dando de baja:', error);
      this.error.set(this.extractError(error) || 'No se pudo dar de baja al miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  async reactivar(item: any): Promise<void> {
    if (!this.puedeReactivar()) {
      this.error.set('No tienes permiso para reactivar miembros.');
      return;
    }

    if (!confirm(`¿Reactivar a ${item.nombre}?`)) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/miembros/${item.id}/reactivar`, {});
      await this.load();
    } catch (error: any) {
      console.error('Error reactivando miembro:', error);
      this.error.set(this.extractError(error) || 'No se pudo reactivar al miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroBaja = '';
  }

  esBaja(item: any): boolean {
    return Number(item.baja) === 1;
  }

  estadoLabel(baja: any): string {
    return Number(baja) === 1 ? 'Baja' : 'Activo';
  }

  estadoClass(baja: any): string {
    return Number(baja) === 1
      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
      : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
  }

  puedeReactivar(): boolean {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const roles = user?.roles || [];

    if (Array.isArray(roles)) {
      const names = roles.map((r: any) => String(r?.name || r || '').toLowerCase());
      return names.includes('admin') || names.includes('super admin');
    }

    const role = String(user?.role || user?.rol || '').toLowerCase();
    return role === 'admin' || role === 'super admin';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  private emptyForm(): any {
    return {
      nombre: '',
      fecha: new Date().toISOString().slice(0, 10),
      rfid: '',
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