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

  async login(email: string, password: string, remember = false): Promise<void> {
    const res: any = await this.api.post('/login', {
      email,
      password,
      remember,
    });

    const token = res.token || res.access_token;

    if (!token) {
      throw new Error('El servidor no devolvió un token de acceso.');
    }

    this.clearStorage();

    if (remember) {
      localStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('token', token);
    }

    await this.loadMe();
  }

  async loadMe(): Promise<void> {
    const me: any = await this.api.get('/me');

    const user: UserSession = {
      id: me.id,
      name: me.name,
      email: me.email,
      roles: Array.isArray(me.roles) ? me.roles : [],
      menus: Array.isArray(me.menus) ? me.menus : [],
    };

    const serializedUser = JSON.stringify(user);

    if (localStorage.getItem('token')) {
      localStorage.setItem('user', serializedUser);
      sessionStorage.removeItem('user');
    } else {
      sessionStorage.setItem('user', serializedUser);
      localStorage.removeItem('user');
    }

    this.user.set(user);
    this.menus.set(user.menus);
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/logout');
    } catch {
      // Aunque el token ya no sea válido, se limpia la sesión local.
    } finally {
      this.clearSession();
      await this.router.navigateByUrl('/login', {
        replaceUrl: true,
      });
    }
  }

  clearSession(): void {
    this.clearStorage();
    this.user.set(null);
    this.menus.set([]);
  }

  getToken(): string | null {
    return (
      sessionStorage.getItem('token') ??
      localStorage.getItem('token')
    );
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
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

  private clearStorage(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
      const raw =
        sessionStorage.getItem('user') ??
        localStorage.getItem('user');

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch {
      sessionStorage.removeItem('user');
      localStorage.removeItem('user');
      return null;
    }
  }
}
