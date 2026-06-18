import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

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
  filtroBaja = '0';

  modal = false;
  editing: any = null;

  form: any = this.emptyForm();

  miembros = computed(() => {
    const search = this.q.trim().toLowerCase();
    const filtro = this.filtroBaja;

    return this.allItems().filter(item => {
      const nombre = String(item.nombre || '').toLowerCase();
      const fecha = String(item.fecha || '').toLowerCase();
      const rfid = String(item.rfid || '').toLowerCase();
      const baja = String(Number(item.baja || 0));
      const estado = baja === '1' ? 'baja' : 'activo';

      const matchesSearch =
        !search ||
        nombre.includes(search) ||
        fecha.includes(search) ||
        rfid.includes(search) ||
        estado.includes(search);

      const matchesBaja = filtro === '' || baja === filtro;

      return matchesSearch && matchesBaja;
    });
  });

  total = computed(() => this.allItems().length);
  activos = computed(() => this.allItems().filter(i => Number(i.baja || 0) === 0).length);
  bajas = computed(() => this.allItems().filter(i => Number(i.baja || 0) === 1).length);

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/miembros');
      this.allItems.set(this.normalizarRespuesta(res));
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar los miembros.');
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
        nombre: item.nombre || '',
        fecha: this.toInputDate(item.fecha),
        rfid: item.rfid || '',
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
    if (!this.form.nombre?.trim()) {
      this.error.set('Escribe el nombre del miembro.');
      return;
    }

    if (!this.form.fecha) {
      this.error.set('Selecciona la fecha.');
      return;
    }

    if (!this.form.rfid?.trim()) {
      this.error.set('Escribe el RFID.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      nombre: this.form.nombre.trim(),
      fecha: this.form.fecha,
      rfid: this.form.rfid.trim(),
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
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo guardar el miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  async darBaja(item: any): Promise<void> {
    if (!confirm(`¿Seguro que deseas dar de baja a ${item.nombre}?`)) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/miembros/${item.id}`);
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo dar de baja al miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  async reactivar(item: any): Promise<void> {
    if (!confirm(`¿Seguro que deseas reactivar a ${item.nombre}?`)) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/miembros/${item.id}/reactivar`, {});
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo reactivar al miembro.');
    } finally {
      this.saving.set(false);
    }
  }

  mostrarActivos(): void {
    this.filtroBaja = '0';
  }

  mostrarBajas(): void {
    this.filtroBaja = '1';
  }

  mostrarTodos(): void {
    this.filtroBaja = '';
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroBaja = '0';
  }

  esBaja(item: any): boolean {
    return Number(item.baja || 0) === 1;
  }

  puedeReactivar(): boolean {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('super admin') || roles.includes('admin');
  }

  estadoLabel(baja: any): string {
    return Number(baja || 0) === 1 ? 'Baja' : 'Activo';
  }

  estadoClass(baja: any): string {
    return Number(baja || 0) === 1
      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
      : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  private toInputDate(fecha: string): string {
    if (!fecha) return '';
    return fecha.toString().split('T')[0];
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
    const data = error?.response?.data ?? error?.data ?? error;

    if (data?.message) return data.message;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      return data.errors[firstKey]?.[0] || 'Error de validación.';
    }

    return '';
  }
}