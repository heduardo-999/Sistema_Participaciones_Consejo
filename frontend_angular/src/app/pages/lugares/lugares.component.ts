import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-lugares',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lugares.component.html',
})
export class LugaresComponent implements OnInit {
  lugares = signal<any[]>([]);
  asignados = signal<any[]>([]);
  participantes = signal<any[]>([]);
  resumen = signal<any>(null);
  selected = signal<any>(null);

  loading = signal(false);
  saving = signal(false);
  error = signal('');

  participante_id = '';
  nuevoStatus = '';

  qrModal = false;
  qrData: any = null;
  qrImage = '';

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [resumenRes, mapaRes, participantesRes]: any[] = await Promise.all([
        this.api.get('/lugares/resumen'),
        this.api.get('/lugares/mapa'),
        this.api.get('/participantes'),
      ]);

      this.resumen.set(resumenRes?.data?.data ?? resumenRes?.data ?? resumenRes);

      const mapaData = mapaRes?.data?.data ?? mapaRes?.data ?? mapaRes ?? {};
      const lugares = Array.isArray(mapaData) ? mapaData : mapaData.lugares ?? [];
      const asignados = Array.isArray(mapaData.asignados) ? mapaData.asignados : [];

      this.lugares.set(lugares);
      this.asignados.set(asignados);

      this.participantes.set(this.normalizarRespuesta(participantesRes));
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudieron cargar los lugares.');
    } finally {
      this.loading.set(false);
    }
  }

  topSeats = computed(() => this.lugares().slice(0, 10));
  rightSeats = computed(() => this.lugares().slice(10, 15));
  bottomSeats = computed(() => this.lugares().slice(15, 25).reverse());
  leftSeats = computed(() => this.lugares().slice(25, 30).reverse());

  participantesDisponibles = computed(() => {
    const asignadosIds = this.asignados()
      .filter(a => !['liberado', 'retirado'].includes(String(a.status || '').toLowerCase()))
      .map(a => Number(a.participante_id));

    return this.participantes().filter(p => {
      if (p.status === 'retirado') return false;
      return !asignadosIds.includes(Number(p.id));
    });
  });

  seleccionar(lugar: any): void {
    this.selected.set(lugar);
    this.participante_id = '';
    this.nuevoStatus = lugar?.status || 'funcional';
    this.error.set('');
  }

  cerrarModal(): void {
    this.selected.set(null);
    this.participante_id = '';
    this.nuevoStatus = '';
  }

  async asignar(): Promise<void> {
    const lugar = this.selected();

    if (!lugar) return;

    if (!this.participante_id) {
      this.error.set('Selecciona un participante.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.post('/lugares-asignados', {
        lugar_id: lugar.id,
        participante_id: Number(this.participante_id),
      });

      await this.load();

      const actualizado = this.lugares().find(l => Number(l.id) === Number(lugar.id));
      if (actualizado) this.selected.set(actualizado);

      this.participante_id = '';
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo asignar el lugar.');
    } finally {
      this.saving.set(false);
    }
  }

  async liberar(): Promise<void> {
    const lugar = this.selected();
    const asignacion = this.asignacionPorLugar(lugar);

    if (!asignacion) {
      this.error.set('Este lugar no tiene asignación activa.');
      return;
    }

    if (!confirm('¿Seguro que deseas liberar este lugar?')) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/lugares-asignados/${asignacion.id}/liberar`, {});
      await this.load();

      const actualizado = this.lugares().find(l => Number(l.id) === Number(lugar.id));
      if (actualizado) this.selected.set(actualizado);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo liberar el lugar.');
    } finally {
      this.saving.set(false);
    }
  }

  async reiniciar(): Promise<void> {
    const lugar = this.selected();
    const asignacion = this.asignacionPorLugar(lugar);

    if (!asignacion) {
      this.error.set('Este lugar no tiene asignación activa.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/lugares-asignados/${asignacion.id}/reiniciar-temporizador`, {});
      await this.load();
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo reiniciar el temporizador.');
    } finally {
      this.saving.set(false);
    }
  }

  async cambiarEstado(): Promise<void> {
    const lugar = this.selected();

    if (!lugar) return;

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/lugares/${lugar.id}`, {
        mesa_id: lugar.mesa_id,
        esp_id: lugar.esp_id,
        status: this.nuevoStatus,
      });

      await this.load();

      const actualizado = this.lugares().find(l => Number(l.id) === Number(lugar.id));
      if (actualizado) this.selected.set(actualizado);
    } catch (error: any) {
      console.error(error);
      this.error.set(this.extractError(error) || 'No se pudo cambiar el estado del ESP32.');
    } finally {
      this.saving.set(false);
    }
  }

 async generarQrLugar(): Promise<void> {
  const lugar = this.selected();
  const asignacion = this.asignacionPorLugar(lugar);

  if (!lugar || !asignacion?.participante_id) {
    this.error.set('Este lugar no tiene participante asignado.');
    return;
  }

  this.saving.set(true);
  this.error.set('');
  this.qrImage = '';

  try {
    const res: any = await this.api.post('/qr/generar', {
      participante_id: Number(asignacion.participante_id),
    });

    this.qrData = res?.data?.data ?? res?.data ?? res;

    if (this.qrData?.url) {
      this.qrImage = await QRCode.toDataURL(this.qrData.url, {
        width: 300,
        margin: 2,
      });
    }

    this.qrModal = true;
  } catch (error: any) {
    console.error(error);
    this.error.set(this.extractError(error) || 'No se pudo generar el QR.');
  } finally {
    this.saving.set(false);
  }
}

async copiarQr(): Promise<void> {
  const url = this.qrData?.url;

  if (!url) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    alert('URL copiada.');
  } catch (error) {
    console.error(error);
    alert('No se pudo copiar la URL. Cópiala manualmente.');
  }
}

  cerrarQr(): void {
    this.qrModal = false;
    this.qrData = null;
    this.qrImage = '';
  }

asignacionPorLugar(lugar: any): any {
  if (!lugar) return null;

  if (
    Array.isArray(lugar.asignaciones) &&
    lugar.asignaciones.length > 0
  ) {
    return lugar.asignaciones[0];
  }

  if (lugar.asignacion) {
    return lugar.asignacion;
  }

  return this.asignados().find(
    a => Number(a.lugar_id) === Number(lugar.id)
  ) || null;
}

participanteAsignado(lugar: any): any {
  const asignacion = this.asignacionPorLugar(lugar);

  if (!asignacion) {
    return null;
  }

  return asignacion.participante || null;
}

  nombreParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);
    if (!participante) return 'Libre';

    return this.nombreParticipante(participante);
  }

  rfidParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);
    if (!participante) return 'Sin RFID';

    return this.rfidParticipante(participante);
  }

  estadoParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);
    return participante?.status || 'sin asignación';
  }

  nombreParticipante(p: any): string {
    return p?.miembro?.nombre || p?.invitado?.nombre || p?.nombre || 'Sin nombre';
  }

  tipoParticipante(p: any): string {
    if (p?.miembro_id || p?.miembro) return 'Miembro';
    if (p?.invitado_id || p?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(p: any): string {
    return p?.miembro?.rfid || p?.rfid || 'Sin RFID';
  }

  reunionParticipante(p: any): string {
    return p?.reunion?.sesion || p?.reunion?.titulo || 'Reunión activa';
  }

  numeroLugar(lugar: any): string {
    return String(lugar?.id || '');
  }

  estadoVisual(lugar: any): string {
    if (!lugar) return 'Sin información';

    if (lugar.status === 'denegado') return 'Denegado';
    if (lugar.status === 'mantenimiento') return 'Mantenimiento';
    if (lugar.status === 'dañada') return 'Dañada';

    const participante = this.participanteAsignado(lugar);

    if (!participante) return 'Disponible';
    if (participante.status === 'ausente') return 'Ausente';

    return 'Ocupado';
  }

  seatClass(lugar: any): string {
    const visual = this.estadoVisual(lugar);

    const classes: Record<string, string> = {
      Disponible: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
      Ocupado: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      Ausente: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
      Mantenimiento: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
      Dañada: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300',
      Denegado: 'border-slate-300 bg-slate-200 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    };

    return classes[visual] || classes['Disponible'];
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      funcional: 'Funcional',
      mantenimiento: 'Mantenimiento',
      dañada: 'Dañada',
      denegado: 'Denegado',
      presente: 'Presente',
      ausente: 'Ausente',
      retirado: 'Retirado',
      liberado: 'Liberado',
      'sin asignación': 'Sin asignación',
    };

    return labels[status] || status || 'Sin estado';
  }

  puedeCambiarEstado(): boolean {
    const roles = this.auth.user()?.roles ?? [];
    return roles.includes('super admin') || roles.includes('admin');
  }

  private normalizarRespuesta(res: any): any[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];
    return Array.isArray(data) ? data : [];
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