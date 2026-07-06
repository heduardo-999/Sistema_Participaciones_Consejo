import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

export interface MenuItem {
  id?: number;
  nombre: string;
  url: string;
  icono?: string;
}

export interface UserSession {
  id: number;
  name: string;
  email: string;
  roles: any[];
  menus: MenuItem[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<UserSession | null>(this.safeParseUser());
  menus = signal<MenuItem[]>(this.user()?.menus || []);

  constructor(
    private api: ApiService,
    private router: Router
  ) {}

  async login(email: string, password: string, remember = false) {
    const res: any = await this.api.post('/login', { email, password, remember });
    const token = res.token || res.access_token;

    localStorage.setItem('token', token);
    await this.loadMe();
  }

  async loadMe() {
    const me: any = await this.api.get('/me');

    const user: UserSession = {
      id: me.id,
      name: me.name,
      email: me.email,
      roles: Array.isArray(me.roles) ? me.roles : [],
      menus: Array.isArray(me.menus) ? me.menus : [],
    };

    localStorage.setItem('user', JSON.stringify(user));
    this.user.set(user);
    this.menus.set(user.menus);
  }

  async logout() {
    try {
      await this.api.post('/logout');
    } catch {}

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.user.set(null);
    this.menus.set([]);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  normalizedRoles(): string[] {
    const roles = this.user()?.roles || [];

    return roles
      .map(role => this.normalizeRole(role))
      .filter(role => !!role);
  }

  hasRole(roles: string[]): boolean {
    const expected = roles.map(role => this.normalizeText(role));
    return this.normalizedRoles().some(role => expected.includes(role));
  }

  esRolOperativo(): boolean {
    return this.hasRole(['super admin', 'admin', 'moderador']);
  }

  isVisualizador(): boolean {
    return this.hasRole(['visualizador']) && !this.esRolOperativo();
  }

  canAccessRoute(url: string): boolean {
    if (!this.isLoggedIn()) {
      return false;
    }

    const cleanUrl = this.normalizeUrl(url);

    if (!this.isVisualizador()) {
      return true;
    }

    return cleanUrl === '' || cleanUrl === '/dashboard';
  }

  private normalizeUrl(url: string): string {
    const clean = String(url || '')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/+$/, '');

    return clean || '';
  }

  private normalizeRole(role: any): string {
    if (role === null || role === undefined) {
      return '';
    }

    if (typeof role === 'string') {
      return this.normalizeText(role);
    }

    if (typeof role === 'object') {
      return this.normalizeText(
        role.name ??
        role.nombre ??
        role.role ??
        role.rol ??
        role.guard_name ??
        ''
      );
    }

    return this.normalizeText(String(role));
  }

  private normalizeText(value: any): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private safeParseUser(): UserSession | null {
    try {
      const raw = localStorage.getItem('user');

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch {
      localStorage.removeItem('user');
      return null;
    }
  }
}
