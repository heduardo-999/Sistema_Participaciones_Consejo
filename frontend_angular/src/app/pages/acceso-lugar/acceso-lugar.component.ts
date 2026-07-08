import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-acceso-lugar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './acceso-lugar.component.html',
})
export class AccesoLugarComponent implements OnInit {
  tipoAcceso: 'lugar' | 'rezagados' = 'lugar';
  lugarId: string | null = null;

  loading = signal(false);
  saving = signal(false);
  error = signal('');
  message = signal('');
  info = signal<any>(null);

  modo = signal<'seleccion' | 'miembro' | 'invitado'>('seleccion');
  codigo = '';
  nombre = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {}

  async ngOnInit(): Promise<void> {
    this.tipoAcceso = this.route.snapshot.routeConfig?.path === 'acceso-rezagados'
      ? 'rezagados'
      : 'lugar';

    this.lugarId = this.route.snapshot.paramMap.get('lugarId');
    await this.cargarInfo();
  }

  async cargarInfo(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const endpoint = this.tipoAcceso === 'rezagados'
        ? '/acceso-rezagados'
        : `/acceso-lugar/${this.lugarId}`;

      const res: any = await this.api.get(endpoint);
      this.info.set(res?.data?.data ?? res?.data ?? res);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo cargar el acceso del lugar.');
    } finally {
      this.loading.set(false);
    }
  }

  seleccionarModo(modo: 'miembro' | 'invitado'): void {
    this.modo.set(modo);
    this.error.set('');
    this.message.set('');
  }

  volver(): void {
    this.modo.set('seleccion');
    this.codigo = '';
    this.nombre = '';
    this.error.set('');
    this.message.set('');
  }

  async entrarComoMiembro(): Promise<void> {
    const codigo = this.codigo.trim();

    if (!/^\d{4,20}$/.test(codigo)) {
      this.error.set('Escribe tu código RFID. Debe iniciar con al menos 4 dígitos.');
      return;
    }

    await this.enviarRegistro('miembro', { codigo });
  }

  async entrarComoInvitado(): Promise<void> {
    const nombre = this.nombre.trim().replace(/\s+/g, ' ');

    if (nombre.length < 3) {
      this.error.set('Escribe tu nombre completo.');
      return;
    }

    await this.enviarRegistro('invitado', { nombre });
  }

  private async enviarRegistro(tipo: 'miembro' | 'invitado', payload: any): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const endpoint = this.tipoAcceso === 'rezagados'
        ? `/acceso-rezagados/${tipo}`
        : `/acceso-lugar/${this.lugarId}/${tipo}`;

      const res: any = await this.api.post(endpoint, payload);
      const body = res?.data?.data ?? res?.data ?? res;

      this.message.set(res?.data?.message || body?.message || 'Registro correcto. Redirigiendo a ESP32 virtual...');

      const token = body?.token;
      const url = body?.url;

      setTimeout(() => {
        if (url) {
          window.location.href = url;
          return;
        }

        if (token) {
          this.router.navigate(['/qr/esp32', token]);
          return;
        }

        this.error.set('No se recibió el acceso a ESP32 virtual.');
      }, 900);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo completar el registro.');
    } finally {
      this.saving.set(false);
    }
  }

  tituloAcceso(): string {
    if (this.tipoAcceso === 'rezagados') return 'Acceso rezagados';
    return `Acceso lugar ${this.info()?.lugar?.numero || this.lugarId || ''}`;
  }

  descripcionAcceso(): string {
    if (this.tipoAcceso === 'rezagados') {
      return 'Este QR asigna automáticamente el primer lugar libre del 27 al 40.';
    }

    return 'Este QR asigna automáticamente el lugar físico que escaneaste.';
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
