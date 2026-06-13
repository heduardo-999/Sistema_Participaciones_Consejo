import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({ selector:'app-login', standalone:true, imports:[FormsModule], templateUrl:'./login.component.html' })
export class LoginComponent {
  email='admin@test.com'; password='password'; remember=false; show=false; loading=false; error=signal('');
  constructor(private auth:AuthService, private router:Router) {}
  async submit(){ this.loading=true; this.error.set(''); try { await this.auth.login(this.email,this.password,this.remember); this.router.navigate(['/dashboard']); } catch(e:any){ this.error.set(e?.response?.data?.message || 'Credenciales incorrectas'); } finally{ this.loading=false; } }
}
