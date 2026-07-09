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
  toast = signal<{ tipo: 'success' | 'error' | 'info'; mensaje: string } | null>(null);
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
      this.mostrarToast(this.error(), 'error');
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

  normalizarCodigo(): void {
    this.codigo = this.codigo.replace(/\D/g, '').slice(0, 4);
  }

  mostrarToast(mensaje: string, tipo: 'success' | 'error' | 'info' = 'info'): void {
    const texto = this.extractError({ message: mensaje }) || mensaje;
    this.toast.set({ mensaje: texto, tipo });
    setTimeout(() => {
      if (this.toast()?.mensaje === texto) this.toast.set(null);
    }, 3800);
  }

  async entrarComoMiembro(): Promise<void> {
    const codigo = this.codigo.trim();

    if (!/^\d{4}$/.test(codigo)) {
      this.error.set('El código RFID debe tener exactamente 4 dígitos.');
      this.mostrarToast('El código RFID debe tener exactamente 4 dígitos.', 'error');
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
      this.mostrarToast(this.message(), 'success');

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
      this.mostrarToast(this.error(), 'error');
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
    const traducir = (mensaje: string): string => {
      const texto = String(mensaje || '').trim();
      const mapa: Record<string, string> = {
        'The codigo field must be 4 digits.': 'El código RFID debe tener exactamente 4 dígitos.',
        'The codigo field is required.': 'El código RFID es obligatorio.',
        'The nombre field is required.': 'El nombre es obligatorio.',
        'The given data was invalid.': 'Los datos no son válidos.',
        'Network Error': 'No se pudo conectar con el servidor.',
        'Request failed with status code 500': 'Ocurrió un error interno del servidor.',
        'Request failed with status code 404': 'No se encontró el recurso solicitado.',
      };
      return mapa[texto] || texto;
    };

    if (data?.message) return traducir(data.message);

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      return traducir(data.errors[firstKey]?.[0] || 'Error de validación.');
    }

    if (error?.message) return traducir(error.message);

    return '';
  }
}
