import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-lugares',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lugares.component.html',
})
export class LugaresComponent implements OnInit, OnDestroy {
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
    private auth: AuthService,
    private realtime: RealtimeService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    this.iniciarSocketLugares();
  }

  ngOnDestroy(): void {
    this.realtime.off('lugares:updated');
    this.realtime.off('participantes:updated');
    this.realtime.off('reunion:updated');
    this.realtime.off('intervenciones:updated');
  }

  private iniciarSocketLugares(): void {
    this.realtime.connect();

    this.realtime.on('lugares:updated', async () => {
      await this.load();
    });

    this.realtime.on('participantes:updated', async () => {
      await this.load();
    });

    this.realtime.on('reunion:updated', async () => {
      await this.load();
    });

    this.realtime.on('intervenciones:updated', async () => {
      await this.load();
    });
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

  // Distribución responsiva de 40 lugares:
  // - 14 lugares en la parte superior externa.
  // - 26 lugares formando la C: 10 arriba, 6 al lado izquierdo y 10 abajo.
  superiorSeats = computed(() => this.lugares().slice(0, 14));
  cTopSeats = computed(() => this.lugares().slice(14, 24));
  cLeftSeats = computed(() => this.lugares().slice(24, 30));
  cBottomSeats = computed(() => this.lugares().slice(30, 40));

  // Compatibilidad con nombres anteriores por si alguna vista o prueba todavía los usa.
  topSeats = computed(() => this.superiorSeats());
  rightSeats = computed(() => []);
  bottomSeats = computed(() => this.cBottomSeats());
  leftSeats = computed(() => this.cLeftSeats());

  asignacionesActivas = computed(() => {
    const asignaciones: any[] = [];

    for (const asignacion of this.asignados()) {
      if (this.esAsignacionActiva(asignacion)) {
        asignaciones.push(asignacion);
      }
    }

    for (const lugar of this.lugares()) {
      if (lugar?.asignacion && this.esAsignacionActiva(lugar.asignacion)) {
        asignaciones.push(lugar.asignacion);
      }

      if (Array.isArray(lugar?.asignaciones)) {
        for (const asignacion of lugar.asignaciones) {
          if (this.esAsignacionActiva(asignacion)) {
            asignaciones.push(asignacion);
          }
        }
      }
    }

    const unicas = new Map<number, any>();

    for (const asignacion of asignaciones) {
      const id = Number(asignacion?.id || 0);

      if (id) {
        unicas.set(id, asignacion);
        continue;
      }

      const participanteId = Number(asignacion?.participante_id || asignacion?.participante?.id || 0);
      const lugarId = Number(asignacion?.lugar_id || asignacion?.lugar?.id || 0);

      if (participanteId && lugarId) {
        unicas.set(Number(`${lugarId}${participanteId}`), asignacion);
      }
    }

    return Array.from(unicas.values());
  });

  participantesAsignadosIds = computed(() => {
    const ids = new Set<number>();

    for (const asignacion of this.asignacionesActivas()) {
      const participanteId = Number(
        asignacion?.participante_id ||
        asignacion?.participante?.id ||
        0
      );

      if (participanteId) {
        ids.add(participanteId);
      }
    }

    return ids;
  });

  participantesDisponibles = computed(() => {
    const asignadosIds = this.participantesAsignadosIds();

    return this.participantes().filter(p => {
      const participanteId = Number(p?.id || 0);
      const status = String(p?.status || '').toLowerCase();

      if (!participanteId) return false;
      if (status === 'retirado') return false;

      return !asignadosIds.has(participanteId);
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

    const participanteId = Number(this.participante_id);

    if (this.participantesAsignadosIds().has(participanteId)) {
      this.error.set('Este participante ya tiene un lugar asignado.');
      return;
    }

    if (this.asignacionPorLugar(lugar)) {
      this.error.set('Este lugar ya tiene una asignación activa. Libera el lugar antes de asignar otro participante.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.post('/lugares-asignados', {
        lugar_id: lugar.id,
        participante_id: participanteId,
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

    if (lugar.asignacion && this.esAsignacionActiva(lugar.asignacion)) {
      return lugar.asignacion;
    }

    if (Array.isArray(lugar.asignaciones)) {
      const activa = lugar.asignaciones.find((a: any) => this.esAsignacionActiva(a));
      if (activa) return activa;
    }

    return this.asignacionesActivas().find(
      a => Number(a.lugar_id || a.lugar?.id) === Number(lugar.id)
    ) || null;
  }

  participanteAsignado(lugar: any): any {
    const asignacion = this.asignacionPorLugar(lugar);

    if (!asignacion) return null;

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
    if (String(participante.status || '').toLowerCase() === 'ausente') return 'Ausente';

    return 'Ocupado';
  }

  seatClass(lugar: any): string {
    const visual = this.estadoVisual(lugar);

    const classes: Record<string, string> = {
      Disponible: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300',
      Ocupado: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      Ausente: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
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

  private esAsignacionActiva(asignacion: any): boolean {
    if (!asignacion) return false;

    const status = String(asignacion.status || '').toLowerCase();

    return !['liberado', 'retirado', 'cancelado', 'cancelada', 'inactivo', 'inactiva'].includes(status);
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