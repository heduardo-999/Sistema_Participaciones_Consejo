import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-qr-esp32',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-esp32.component.html',
})
export class QrEsp32Component implements OnInit, OnDestroy {
  token = '';
  refreshInterval: any = null;

  loading = signal(false);
  refreshing = signal(false);
  sending = signal(false);
  error = signal('');
  message = signal('');

  data = signal<any>(null);

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.error.set('No se encontró el token QR.');
      return;
    }

    await this.validarToken();

    this.refreshInterval = setInterval(() => {
      this.validarToken(true);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async validarToken(silent = false): Promise<void> {
    if (silent) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }

    this.error.set('');

    try {
      const res: any = await this.api.post('/qr/validar', {
        token: this.token,
      });

      this.data.set(res?.data?.data ?? res?.data ?? res);
    } catch (error: any) {
      console.error('Error validando QR:', error);
      this.error.set(this.extractError(error) || 'QR inválido, expirado o reunión no activa.');
      this.data.set(null);

      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  async pulsarBoton(): Promise<void> {
    if (!this.token || this.sending()) return;

    this.sending.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const res: any = await this.api.post('/qr/interaccion', {
        token: this.token,
        accion: 'solicitar_intervencion',
      });

      const body = res?.data ?? res;

      this.message.set(body?.message || 'Acción realizada correctamente.');
      this.data.set(body?.data ?? body);

      setTimeout(() => {
        this.message.set('');
      }, 3500);
    } catch (error: any) {
      console.error('Error realizando acción:', error);
      this.error.set(this.extractError(error) || 'No se pudo realizar la acción.');
    } finally {
      this.sending.set(false);
    }
  }

  participante(): any {
    return this.data()?.participante || {};
  }

  reunion(): any {
    return this.data()?.reunion || {};
  }

  intervencion(): any {
    return this.data()?.intervencion || {};
  }

  estadoParticipante(): string {
    return String(this.participante()?.status || '').toLowerCase();
  }

  estadoLedParticipante(): string {
    const estado = this.estadoParticipante();

    if (estado === 'presente') return 'verde';
    if (estado === 'ausente') return 'azul';
    if (estado === 'retirado') return 'rojo';

    return 'rojo';
  }

  estadoLedIntervencion(): string {
    return this.intervencion()?.estado_led || 'no_participa';
  }

  textoBoton(): string {
    if (this.sending()) return 'Procesando...';

    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') {
      return 'Cancelar solicitud';
    }

    if (estado === 'participa') {
      return 'Finalizar intervención';
    }

    return 'Solicitar intervención';
  }

  textoIntervencion(): string {
    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') {
      return 'Solicitud pendiente';
    }

    if (estado === 'participa') {
      return 'Participando ahora';
    }

    return 'Sin intervención';
  }

  descripcionBoton(): string {
    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') {
      return 'Pulsa nuevamente para cancelar la solicitud.';
    }

    if (estado === 'participa') {
      return 'Pulsa cuando termines tu intervención.';
    }

    return 'Pulsa para pedir la palabra en la reunión.';
  }

  ledParticipanteClass(): string {
    const estado = this.estadoLedParticipante();

    if (estado === 'verde') return 'bg-green-400 shadow-[0_0_30px_rgba(74,222,128,0.95)]';
    if (estado === 'azul') return 'bg-blue-400 shadow-[0_0_30px_rgba(96,165,250,0.95)]';

    return 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.95)]';
  }

  ledParticipanteTexto(): string {
    const estado = this.estadoLedParticipante();

    if (estado === 'verde') return 'Activo';
    if (estado === 'azul') return 'Ausente';

    return 'Inactivo';
  }

  ledIntervencionClass(): string {
    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') {
      return 'bg-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.95)] animate-pulse';
    }

    if (estado === 'participa') {
      return 'bg-yellow-300 shadow-[0_0_30px_rgba(253,224,71,0.95)]';
    }

    return 'bg-slate-700 shadow-inner';
  }

  ledIntervencionTexto(): string {
    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') return 'Parpadeando';
    if (estado === 'participa') return 'Encendido';

    return 'Apagado';
  }

  actionButtonClass(): string {
    const estado = this.estadoLedIntervencion();

    if (estado === 'solicita_participacion') {
      return 'bg-yellow-500 text-slate-950 hover:bg-yellow-400';
    }

    if (estado === 'participa') {
      return 'bg-red-600 text-white hover:bg-red-700';
    }

    return 'bg-blue-700 text-white hover:bg-blue-600';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  formatDateTime(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;

    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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