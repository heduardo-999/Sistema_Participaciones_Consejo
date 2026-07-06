import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrudService } from '../../core/services/crud.service';

type RolOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
})
export class UsuariosComponent implements OnInit {
  allItems = signal<any[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  qInput = signal('');
  q = signal('');
  filtroRol = signal('');
  filtroEstado = signal('');

  modal = false;
  editing: any = null;

  roles: RolOption[] = [
    { value: 'super admin', label: 'Super Admin' },
    { value: 'admin', label: 'Admin' },
    { value: 'moderador', label: 'Moderador' },
  ];

  form: any = this.emptyForm();

  items = computed(() => {
    const search = this.q().trim().toLowerCase();
    const rol = this.filtroRol();
    const estado = this.filtroEstado();

    return this.allItems().filter(item => {
      const nombre = this.nombreUsuario(item).toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const roles = this.rolesUsuario(item).toLowerCase();
      const estadoTexto = this.estadoUsuario(item).toLowerCase();

      const matchesSearch =
        !search ||
        nombre.includes(search) ||
        email.includes(search) ||
        roles.includes(search) ||
        estadoTexto.includes(search);

      const matchesRol = !rol || roles.includes(rol);
      const matchesEstado = !estado || estadoTexto === estado;

      return matchesSearch && matchesRol && matchesEstado;
    });
  });

  total = computed(() => this.items().length);
  activos = computed(() => this.items().filter(i => Number(i.baja || 0) === 0).length);
  bajas = computed(() => this.items().filter(i => Number(i.baja || 0) === 1).length);

  constructor(private crud: CrudService) {}

  async ngOnInit(): Promise<void> {
    await this.loadRoles();
    await this.load();
  }

  async loadRoles(): Promise<void> {
    try {
      const res: any = await this.crud.list('/users/roles', {});
      const roles = this.normalizarRoles(res);

      if (roles.length > 0) {
        this.roles = roles;
      }
    } catch (error) {
      console.error('Error cargando roles:', error);
      // Si la ruta falla, dejamos los roles base para que la interfaz no quede en blanco.
    }

    if (!this.form?.role) {
      this.form = this.emptyForm();
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.crud.list('/users', {});
      this.allItems.set(this.normalizarRespuesta(res));
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      this.error.set('No se pudieron cargar los usuarios.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  buscar(): void {
    this.q.set(this.qInput().trim());
  }

  limpiarFiltros(): void {
    this.qInput.set('');
    this.q.set('');
    this.filtroRol.set('');
    this.filtroEstado.set('');
  }

  open(item?: any): void {
    this.error.set('');
    this.editing = item || null;

    if (item) {
      this.form = {
        name: item.name || item.nombre || '',
        email: item.email || '',
        role: this.primerRol(item) || this.defaultRoleValue(),
        password: '',
        baja: Number(item.baja || 0),
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
    if (!this.form.name || !this.form.email || !this.form.role) {
      this.error.set('Completa nombre, correo y rol.');
      return;
    }

    if (!this.editing && !this.form.password) {
      this.error.set('La contraseña es obligatoria al crear usuario.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload: any = {
      name: this.form.name,
      email: this.form.email,
      role: this.form.role,
      baja: Number(this.form.baja || 0),
    };

    if (this.form.password) {
      payload.password = this.form.password;
    }

    try {
      if (this.editing) {
        await this.crud.update('/users', this.editing.id, payload);
      } else {
        await this.crud.create('/users', payload);
      }

      this.close();
      await this.loadRoles();
      await this.load();
    } catch (error: any) {
      console.error('Error guardando usuario:', error);
      this.error.set(this.extractError(error) || 'No se pudo guardar el usuario.');
    } finally {
      this.saving.set(false);
    }
  }

  async darBaja(item: any): Promise<void> {
    if (!confirm(`¿Dar de baja a ${this.nombreUsuario(item)}?`)) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.crud.remove('/users', item.id);
      await this.load();
    } catch (error: any) {
      console.error('Error dando de baja usuario:', error);
      this.error.set(this.extractError(error) || 'No se pudo dar de baja el usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  async reactivar(item: any): Promise<void> {
    if (!confirm(`¿Reactivar a ${this.nombreUsuario(item)}?`)) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.crud.update('/users', item.id, {
        name: item.name || item.nombre,
        email: item.email,
        role: this.primerRol(item) || this.defaultRoleValue(),
        baja: 0,
      });

      await this.load();
    } catch (error: any) {
      console.error('Error reactivando usuario:', error);
      this.error.set(this.extractError(error) || 'No se pudo reactivar el usuario.');
    } finally {
      this.loading.set(false);
    }
  }

  nombreUsuario(item: any): string {
    return item?.name || item?.nombre || 'Sin nombre';
  }

  rolesUsuario(item: any): string {
    if (Array.isArray(item?.roles)) {
      return item.roles
        .map((r: any) => typeof r === 'string' ? r : r?.name)
        .filter(Boolean)
        .join(', ');
    }

    return item?.rol || item?.role || 'Sin rol';
  }

  primerRol(item: any): string {
    if (Array.isArray(item?.roles) && item.roles.length > 0) {
      const rol = item.roles[0];
      return typeof rol === 'string' ? rol : rol?.name || '';
    }

    return item?.rol || item?.role || '';
  }

  estadoUsuario(item: any): string {
    return Number(item?.baja || 0) === 1 ? 'baja' : 'activo';
  }

  estadoClass(item: any): string {
    return Number(item?.baja || 0) === 1
      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
      : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
  }

  formatDate(fecha: string): string {
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

  private emptyForm(): any {
    return {
      name: '',
      email: '',
      role: this.defaultRoleValue(),
      password: '',
      baja: 0,
    };
  }

  private defaultRoleValue(): string {
    const moderador = this.roles.find(r => r.value === 'moderador');

    return moderador?.value || this.roles[0]?.value || '';
  }

  private normalizarRespuesta(res: any): any[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];

    return Array.isArray(data) ? data : [];
  }

  private normalizarRoles(res: any): RolOption[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];

    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .map((rol: any): RolOption | null => {
        const value = String(
          rol?.value ||
          rol?.name ||
          rol?.nombre ||
          rol ||
          ''
        ).trim();

        if (!value) return null;

        const label = String(
          rol?.label ||
          rol?.display_name ||
          rol?.name ||
          rol?.nombre ||
          value
        ).trim();

        return {
          value,
          label: this.formatearRol(label),
        };
      })
      .filter((rol): rol is RolOption => !!rol?.value);
  }

  private formatearRol(value: string): string {
    return value
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
      .join(' ');
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
