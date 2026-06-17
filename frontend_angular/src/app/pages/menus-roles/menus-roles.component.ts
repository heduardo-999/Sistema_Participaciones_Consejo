import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CrudService } from '../../core/services/crud.service';

@Component({
  selector: 'app-menus-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './menus-roles.component.html',
})
export class MenusRolesComponent implements OnInit {
  roles = signal<any[]>([]);
  menus = signal<any[]>([]);
  selectedRole = signal<any>(null);
  selectedMenuIds = signal<number[]>([]);

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  success = signal('');

  constructor(private crud: CrudService) {}

  esSuperAdminSeleccionado = computed(() => {
    return this.selectedRole()?.name === 'super admin';
  });

  menusVisibles = computed(() => {
    const role = this.selectedRole();
    const isSuperAdmin = role?.name === 'super admin';

    const rutasOcultasParaNoSuperAdmin = [
      '/menus-roles',
      '/roles-permisos',
      '/lugares-asignados',
    ];

    return this.menus().filter(menu => {
      if (Number(menu.baja || 0) === 1) return false;

      if (isSuperAdmin) {
        return menu.url !== '/lugares-asignados';
      }

      return !rutasOcultasParaNoSuperAdmin.includes(menu.url);
    });
  });

  totalMenus = computed(() => this.menusVisibles().length);
  menusActivos = computed(() => this.menusVisibles().filter(m => Number(m.baja || 0) === 0).length);
  totalRoles = computed(() => this.roles().length);
  asignados = computed(() => {
    return this.selectedMenuIds().filter(id =>
      this.menusVisibles().some(menu => Number(menu.id) === Number(id))
    ).length;
  });

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const [rolesRes, menusRes]: any = await Promise.all([
        this.crud.list('/roles-admin', {}),
        this.crud.list('/menus-admin', {}),
      ]);

      this.roles.set(this.normalizarRespuesta(rolesRes));
      this.menus.set(this.normalizarRespuesta(menusRes));

      if (this.roles().length > 0 && !this.selectedRole()) {
        await this.seleccionarRol(this.roles()[0]);
      }
    } catch (error) {
      console.error(error);
      this.error.set('No se pudieron cargar roles o menús.');
    } finally {
      this.loading.set(false);
    }
  }

  async seleccionarRol(role: any): Promise<void> {
    this.selectedRole.set(role);
    this.selectedMenuIds.set([]);
    this.error.set('');
    this.success.set('');

    try {
      const res: any = await this.crud.list(`/roles/${role.id}/menus`, {});
      const data = res?.data?.data ?? res?.data ?? res ?? {};
      this.selectedMenuIds.set((data.menu_ids || []).map((id: any) => Number(id)));
    } catch (error) {
      console.error(error);
      this.error.set('No se pudieron cargar los menús del rol.');
    }
  }

  toggleMenu(menuId: number): void {
    if (this.esSuperAdminSeleccionado()) {
      this.error.set('No se pueden modificar los menús del super admin.');
      return;
    }

    const current = this.selectedMenuIds();

    if (current.includes(menuId)) {
      this.selectedMenuIds.set(current.filter(id => id !== menuId));
    } else {
      this.selectedMenuIds.set([...current, menuId]);
    }
  }

  isChecked(menuId: number): boolean {
    return this.selectedMenuIds().includes(Number(menuId));
  }

  async guardar(): Promise<void> {
    if (!this.selectedRole()) {
      this.error.set('Selecciona un rol.');
      return;
    }

    if (this.esSuperAdminSeleccionado()) {
      this.error.set('No se pueden modificar los menús del super admin.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    const menuIdsPermitidos = this.selectedMenuIds().filter(id =>
      this.menusVisibles().some(menu => Number(menu.id) === Number(id))
    );

    try {
      await this.crud.create(`/roles/${this.selectedRole().id}/menus`, {
        menu_ids: menuIdsPermitidos,
      });

      this.selectedMenuIds.set(menuIdsPermitidos);
      this.success.set('Menús asignados correctamente. Cierra sesión y vuelve a entrar para ver los cambios.');
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron guardar los menús.');
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