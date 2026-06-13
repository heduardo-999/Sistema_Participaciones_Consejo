import { Component, computed, signal } from '@angular/core';
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
export class LayoutComponent {
  sidebarOpen = signal(true);
  theme = signal(localStorage.getItem('theme') || 'light');

  pageTitle = signal('Dashboard');
  breadcrumb = signal('INICIO / DASHBOARD');

  user = computed(() => this.auth.user());

  menu = computed(() => {
    const menus = this.auth.user()?.menus ?? [];

    if (menus.length > 0) {
      return menus.map((item: any) => ({
        label: item.nombre ?? item.name,
        route: item.url ?? item.route,
        icon: item.icono ?? '•',
      }));
    }

    return [
      { label: 'Dashboard', route: '/dashboard', icon: '⌂' },
      { label: 'Miembros', route: '/miembros', icon: 'M' },
      { label: 'Invitados', route: '/invitados', icon: 'I' },
      { label: 'Reuniones', route: '/reuniones', icon: 'R' },
      { label: 'Participantes', route: '/participantes', icon: 'P' },
      { label: 'Intervenciones', route: '/intervenciones', icon: 'V' },
      { label: 'Lugares', route: '/lugares', icon: 'L' },
      { label: 'Historial', route: '/historial', icon: 'H' },
      { label: 'Usuarios', route: '/usuarios', icon: 'U' },
    ];
  });

  constructor(
    private auth: AuthService,
    private router: Router
  ) {
    document.documentElement.classList.toggle('dark', this.theme() === 'dark');

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateTitle());
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
      esp32: 'ESP32 Virtual',
      qr: 'Acceso QR',
    };

    const title = titles[url] ?? 'Dashboard';

    this.pageTitle.set(title);
    this.breadcrumb.set(`INICIO / ${title.toUpperCase()}`);
  }
}
