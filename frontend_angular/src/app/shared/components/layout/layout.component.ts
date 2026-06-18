import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  NavigationEnd,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
})
export class LayoutComponent implements OnDestroy {
  sidebarOpen = signal(true);
  theme = signal(localStorage.getItem('theme') || 'light');
  modoPresentacion = signal(document.body.classList.contains('modo-presentacion'));

  pageTitle = signal('Dashboard');
  breadcrumb = signal('INICIO / DASHBOARD');

  user = computed(() => this.auth.user());

  private modoPresentacionHandler = () => {
    this.modoPresentacion.set(document.body.classList.contains('modo-presentacion'));
  };

  menu = computed(() => {
    const user = this.auth.user();

    const rawMenus: any = user?.menus ?? [];
    const roles: string[] = user?.roles ?? [];

    const isSuperAdmin = roles.includes('super admin');

    const menus: any[] = Array.isArray(rawMenus)
      ? rawMenus
      : rawMenus?.data ?? [];

    const rutasSoloSuperAdmin = [
      '/menus-roles',
      '/roles-permisos',
    ];

    const rutasOcultas = [
      '/lugares-asignados',
    ];

    return menus
      .filter((item: any) => Number(item.baja || 0) === 0)
      .filter((item: any) => !rutasOcultas.includes(item.url))
      .filter((item: any) => {
        if (isSuperAdmin) return true;
        return !rutasSoloSuperAdmin.includes(item.url);
      })
      .map((item: any) => ({
        label: item.nombre ?? item.name,
        route: item.url ?? item.route,
        icon: item.icono ?? '•',
      }));
  });

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    document.documentElement.classList.toggle('dark', this.theme() === 'dark');

    window.addEventListener('modo-presentacion-change', this.modoPresentacionHandler);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateTitle());

    this.updateTitle();
  }

  ngOnDestroy(): void {
    window.removeEventListener('modo-presentacion-change', this.modoPresentacionHandler);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(value => !value);
  }

  toggleTheme(): void {
    this.theme.update(value => {
      const newTheme = value === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return newTheme;
    });
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private updateTitle(): void {
    const url = this.router.url.replace('/', '').split('/')[0];

    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      miembros: 'Miembros',
      invitados: 'Invitados',
      reuniones: 'Reuniones',
      participantes: 'Participantes',
      intervenciones: 'Intervenciones',
      lugares: 'Mapa de lugares',
      historial: 'Historial',
      usuarios: 'Usuarios',
      'menus-roles': 'Menús por Rol',
      'roles-permisos': 'Roles y Permisos',
      esp32: 'ESP32 Virtual',
      qr: 'Acceso QR',
    };

    const title = titles[url] ?? 'Dashboard';

    this.pageTitle.set(title);
    this.breadcrumb.set(`INICIO / ${title.toUpperCase()}`);
  }
}