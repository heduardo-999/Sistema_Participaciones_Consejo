import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';

export interface MenuItem { id?: number; nombre: string; url: string; icono?: string; }
export interface UserSession { id:number; name:string; email:string; roles:string[]; menus:MenuItem[]; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  user = signal<UserSession | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  menus = signal<MenuItem[]>(this.user()?.menus || []);
  constructor(private api: ApiService, private router: Router) {}
  async login(email: string, password: string, remember = false) {
    const res:any = await this.api.post('/login', { email, password, remember });
    const token = res.token || res.access_token;
    localStorage.setItem('token', token);
    await this.loadMe();
  }
  async loadMe() {
    const me:any = await this.api.get('/me');
    const user: UserSession = { id: me.id, name: me.name, email: me.email, roles: me.roles || [], menus: me.menus || [] };
    localStorage.setItem('user', JSON.stringify(user));
    this.user.set(user); this.menus.set(user.menus);
  }
  async logout() {
    try { await this.api.post('/logout'); } catch {}
    localStorage.removeItem('token'); localStorage.removeItem('user'); this.user.set(null); this.menus.set([]); this.router.navigate(['/login']);
  }
  isLoggedIn() { return !!localStorage.getItem('token'); }
  hasRole(roles:string[]) { return this.user()?.roles?.some(r => roles.includes(r)) ?? false; }
}
