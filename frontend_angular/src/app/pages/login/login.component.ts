import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  remember = false;
  show = false;
  loading = false;
  error = signal('');

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  async submit(): Promise<void> {
    if (this.loading) {
      return;
    }

    this.error.set('');

    const email = this.email.trim();

    if (!email || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }

    this.loading = true;

    try {
      await this.auth.login(email, this.password, this.remember);
      await this.router.navigateByUrl('/dashboard', {
        replaceUrl: true,
      });
    } catch (error: any) {
      this.error.set(
        error?.response?.data?.message ||
        error?.message ||
        'Credenciales incorrectas'
      );
    } finally {
      this.loading = false;
    }
  }
}
