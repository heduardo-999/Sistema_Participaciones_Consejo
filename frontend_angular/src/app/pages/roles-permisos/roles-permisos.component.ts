import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrudService } from '../../core/services/crud.service';

@Component({
  selector: 'app-roles-permisos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles-permisos.component.html',
})
export class RolesPermisosComponent implements OnInit {
  roles = signal<any[]>([]);
  permissions = signal<any[]>([]);
  selectedRole = signal<any>(null);
  selectedPermissionIds = signal<number[]>([]);

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  nuevoRol = '';
  nuevoPermiso = '';
  qPermiso = signal('');

  constructor(private crud: CrudService) {}

  totalRoles = computed(() => this.roles().length);
  totalPermisos = computed(() => this.permissions().length);
  asignados = computed(() => this.selectedPermissionIds().length);

  permisosFiltrados = computed(() => {
    const q = this.qPermiso().trim().toLowerCase();

    return this.permissions().filter(p => {
      const name = String(p.name || '').toLowerCase();
      return !q || name.includes(q);
    });
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const [rolesRes, permissionsRes]: any = await Promise.all([
        this.crud.list('/roles-admin', {}),
        this.crud.list('/permissions-admin', {}),
      ]);

      this.roles.set(this.normalizarRespuesta(rolesRes));
      this.permissions.set(this.normalizarRespuesta(permissionsRes));

      if (this.roles().length > 0 && !this.selectedRole()) {
        await this.seleccionarRol(this.roles()[0]);
      }
    } catch (error) {
      console.error(error);
      this.error.set('No se pudieron cargar roles o permisos.');
    } finally {
      this.loading.set(false);
    }
  }

  async seleccionarRol(role: any): Promise<void> {
    this.selectedRole.set(role);
    this.selectedPermissionIds.set([]);
    this.error.set('');
    this.success.set('');

    try {
      const res: any = await this.crud.list(`/roles/${role.id}/permissions`, {});
      const data = res?.data?.data ?? res?.data ?? res ?? {};
      this.selectedPermissionIds.set((data.permission_ids || []).map((id: any) => Number(id)));
    } catch (error) {
      console.error(error);
      this.error.set('No se pudieron cargar los permisos del rol.');
    }
  }

  togglePermission(permissionId: number): void {
    const current = this.selectedPermissionIds();

    if (current.includes(permissionId)) {
      this.selectedPermissionIds.set(current.filter(id => id !== permissionId));
    } else {
      this.selectedPermissionIds.set([...current, permissionId]);
    }
  }

  isChecked(permissionId: number): boolean {
    return this.selectedPermissionIds().includes(Number(permissionId));
  }

  async crearRol(): Promise<void> {
    if (!this.nuevoRol.trim()) {
      this.error.set('Escribe el nombre del rol.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.crud.create('/roles-admin', {
        name: this.nuevoRol.trim(),
      });

      this.nuevoRol = '';
      this.success.set('Rol creado correctamente.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo crear el rol.');
    } finally {
      this.saving.set(false);
    }
  }

  async crearPermiso(): Promise<void> {
    if (!this.nuevoPermiso.trim()) {
      this.error.set('Escribe el nombre del permiso.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.crud.create('/permissions-admin', {
        name: this.nuevoPermiso.trim(),
      });

      this.nuevoPermiso = '';
      this.success.set('Permiso creado correctamente.');
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo crear el permiso.');
    } finally {
      this.saving.set(false);
    }
  }

  async guardarPermisos(): Promise<void> {
    if (!this.selectedRole()) {
      this.error.set('Selecciona un rol.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.crud.create(`/roles/${this.selectedRole().id}/permissions`, {
        permission_ids: this.selectedPermissionIds(),
      });

      this.success.set('Permisos asignados correctamente.');
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron guardar los permisos.');
    } finally {
      this.saving.set(false);
    }
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