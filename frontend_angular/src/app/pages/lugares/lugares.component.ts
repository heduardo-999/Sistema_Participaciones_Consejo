import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { RealtimeService } from '../../core/services/realtime.service';
import * as QRCode from 'qrcode';
import { jsPDF } from 'jspdf';

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
  generandoPdfQr = signal(false);

  participante_id = '';
  nuevoStatus = '';

  qrModal = false;
  qrData: any = null;
  qrImage = '';

  accesoQrModal = false;
  accesoQrData: any = null;
  accesoQrImage = '';

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
  // - La mesa principal en forma de C usa los lugares 1 al 26.
  // - La parte superior externa usa los lugares 27 al 40.
  // - La C se divide en 10 arriba, 6 al lado izquierdo y 10 abajo.
  cTopSeats = computed(() => this.lugares().slice(0, 10));
  cLeftSeats = computed(() => this.lugares().slice(10, 16));
  cBottomSeats = computed(() => this.lugares().slice(16, 26));
  superiorSeats = computed(() => this.lugares().slice(26, 40));

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


  async generarPdfQrEstaticos(): Promise<void> {
    if (this.generandoPdfQr()) return;

    this.generandoPdfQr.set(true);
    this.error.set('');

    try {
      const baseUrl = this.frontendBaseUrl();

      const codigos = [
        ...Array.from({ length: 26 }, (_, indice) => ({
          nombre: `LUGAR ${indice + 1}`,
          descripcion: `Acceso fijo para el lugar ${indice + 1}`,
          url: `${baseUrl}/acceso-lugar/${indice + 1}`,
        })),
        {
          nombre: 'REZAGADOS',
          descripcion: 'Asignación automática de lugares 27 al 40',
          url: `${baseUrl}/acceso-rezagados`,
        },
      ];

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const margenX = 12;
      const margenY = 14;
      const espacioX = 8;
      const espacioY = 8;
      const columnas = 2;
      const filas = 3;
      const porPagina = columnas * filas;
      const anchoTarjeta = (210 - margenX * 2 - espacioX) / columnas;
      const altoTarjeta = (297 - margenY * 2 - espacioY * 2) / filas;
      const tamanoQr = 58;

      for (let indice = 0; indice < codigos.length; indice++) {
        const posicionPagina = indice % porPagina;

        if (indice > 0 && posicionPagina === 0) {
          pdf.addPage();
        }

        const columna = posicionPagina % columnas;
        const fila = Math.floor(posicionPagina / columnas);
        const x = margenX + columna * (anchoTarjeta + espacioX);
        const y = margenY + fila * (altoTarjeta + espacioY);
        const codigo = codigos[indice];

        const qr = await QRCode.toDataURL(codigo.url, {
          width: 700,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });

        pdf.setDrawColor(30, 41, 59);
        pdf.setLineWidth(0.45);
        pdf.roundedRect(x, y, anchoTarjeta, altoTarjeta, 3, 3, 'S');

        pdf.setFillColor(15, 23, 42);
        pdf.roundedRect(x, y, anchoTarjeta, 13, 3, 3, 'F');
        pdf.rect(x, y + 9, anchoTarjeta, 4, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(codigo.nombre === 'REZAGADOS' ? 15 : 17);
        pdf.text(codigo.nombre, x + anchoTarjeta / 2, y + 8.5, {
          align: 'center',
        });

        const qrX = x + (anchoTarjeta - tamanoQr) / 2;
        const qrY = y + 18;
        pdf.addImage(qr, 'PNG', qrX, qrY, tamanoQr, tamanoQr);

        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9.5);

        const lineasDescripcion = pdf.splitTextToSize(
          codigo.descripcion,
          anchoTarjeta - 12
        );

        pdf.text(
          lineasDescripcion,
          x + anchoTarjeta / 2,
          qrY + tamanoQr + 6,
          { align: 'center' }
        );

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(6.5);

        const urlCorta = pdf.splitTextToSize(
          codigo.url,
          anchoTarjeta - 12
        );

        pdf.text(
          urlCorta,
          x + anchoTarjeta / 2,
          y + altoTarjeta - 8,
          { align: 'center' }
        );

        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          'Recorta por el borde y colócalo en el lugar físico.',
          x + anchoTarjeta / 2,
          y + altoTarjeta - 3.5,
          { align: 'center' }
        );
      }

      const totalPaginas = pdf.getNumberOfPages();

      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        pdf.setPage(pagina);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          `Sistema de Gestión de Participaciones · Página ${pagina} de ${totalPaginas}`,
          105,
          293,
          { align: 'center' }
        );
      }

      pdf.save('codigos-qr-lugares-y-rezagados.pdf');
    } catch (error: any) {
      console.error('Error generando PDF de códigos QR:', error);
      this.error.set(
        this.extractError(error) ||
        'No se pudo generar el PDF de códigos QR.'
      );
    } finally {
      this.generandoPdfQr.set(false);
    }
  }


  async generarQrAccesoLugar(lugar: any): Promise<void> {
    if (!lugar?.id) return;

    const id = Number(lugar.id);

    if (id >= 27 && id <= 40) {
      await this.generarQrRezagados();
      return;
    }

    if (id < 1 || id > 26) {
      this.error.set('Solo los lugares 1 al 26 tienen QR individual.');
      return;
    }

    const url = `${this.frontendBaseUrl()}/acceso-lugar/${id}`;

    this.accesoQrData = {
      tipo: 'lugar',
      titulo: `QR estático lugar ${id}`,
      descripcion: 'Este QR asigna automáticamente este lugar físico.',
      url,
    };

    this.accesoQrImage = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
    });

    this.accesoQrModal = true;
  }

  async generarQrRezagados(): Promise<void> {
    const url = `${this.frontendBaseUrl()}/acceso-rezagados`;

    this.accesoQrData = {
      tipo: 'rezagados',
      titulo: 'QR rezagados 27 al 40',
      descripcion: 'Este QR asigna automáticamente el primer lugar libre del 27 al 40.',
      url,
    };

    this.accesoQrImage = await QRCode.toDataURL(url, {
      width: 320,
      margin: 2,
    });

    this.accesoQrModal = true;
  }

  async copiarQrAcceso(): Promise<void> {
    const url = this.accesoQrData?.url;

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

  cerrarQrAcceso(): void {
    this.accesoQrModal = false;
    this.accesoQrData = null;
    this.accesoQrImage = '';
  }

  private frontendBaseUrl(): string {
    return window.location.origin;
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