import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-participantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './participantes.component.html',
})
export class ParticipantesComponent implements OnInit {
  allItems = signal<any[]>([]);
  miembros = signal<any[]>([]);
  invitados = signal<any[]>([]);
  reuniones = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);
  error = signal('');

  q = '';
  filtroStatus = '';
  filtroReunion = '';

  modal = false;
  editing: any = null;

  qrModal = false;
  qrData: any = null;
  qrImage = '';

  form: any = this.emptyForm();

  estados = [
    { value: '', label: 'Todos' },
    { value: 'presente', label: 'Presente' },
    { value: 'ausente', label: 'Ausente' },
    { value: 'retirado', label: 'Retirado' },
  ];

  items = computed(() => {
    const search = this.q.trim().toLowerCase();
    const status = this.filtroStatus;
    const reunion = this.filtroReunion;

    return this.allItems().filter(item => {
      const nombre = this.nombreParticipante(item).toLowerCase();
      const tipo = this.tipoParticipante(item).toLowerCase();
      const rfid = this.rfidParticipante(item).toLowerCase();
      const reunionNombre = this.nombreReunion(item).toLowerCase();
      const estado = String(item.status || '').toLowerCase();

      const matchesSearch =
        !search ||
        nombre.includes(search) ||
        tipo.includes(search) ||
        rfid.includes(search) ||
        reunionNombre.includes(search) ||
        estado.includes(search);

      const matchesStatus = !status || item.status === status;
      const matchesReunion = !reunion || String(item.reunion_id) === String(reunion);

      return matchesSearch && matchesStatus && matchesReunion;
    });
  });

  total = computed(() => this.items().length);
  presentes = computed(() => this.items().filter(i => i.status === 'presente').length);
  ausentes = computed(() => this.items().filter(i => i.status === 'ausente').length);
  retirados = computed(() => this.items().filter(i => i.status === 'retirado').length);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.loadCatalogos();
    await this.load();
  }

  async loadCatalogos(): Promise<void> {
    try {
      const [miembrosRes, invitadosRes, reunionesRes]: any[] = await Promise.all([
        this.api.get('/miembros'),
        this.api.get('/invitados'),
        this.api.get('/reuniones'),
      ]);

      this.miembros.set(
        this.normalizarRespuesta(miembrosRes).filter((m: any) => Number(m.baja) === 0)
      );

      this.invitados.set(this.normalizarRespuesta(invitadosRes));

      this.reuniones.set(
        this.normalizarRespuesta(reunionesRes).filter((r: any) => r.status === 'activa')
      );
    } catch (error) {
      console.error('Error cargando catálogos:', error);
      this.error.set('No se pudieron cargar miembros, invitados o reuniones.');
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/participantes');
      const participantes = this.normalizarRespuesta(res);

      this.allItems.set(
        participantes.filter((p: any) => p?.reunion?.status === 'activa')
      );
    } catch (error) {
      console.error('Error cargando participantes:', error);
      this.error.set('No se pudieron cargar los participantes.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  open(item?: any): void {
    this.error.set('');
    this.editing = item || null;

    if (item) {
      this.form = {
        tipo: item.miembro_id ? 'miembro' : 'invitado',
        miembro_id: item.miembro_id || '',
        invitado_id: item.invitado_id || '',
        reunion_id: item.reunion_id || '',
        status: item.status === 'ausente' ? 'presente' : item.status || 'presente',
      };
    } else {
      this.form = this.emptyForm();
    }

    this.modal = true;
  }

  close(): void {
    this.modal = false;
    this.editing = null;
    this.form = this.emptyForm();
    this.error.set('');
  }

  cambiarTipo(tipo: string): void {
    this.form.tipo = tipo;

    if (tipo === 'miembro') this.form.invitado_id = '';
    if (tipo === 'invitado') this.form.miembro_id = '';
  }

  obtenerFechaReunion(reunionId: any): string {
    const reunion = this.reuniones().find(r => String(r.id) === String(reunionId));
    return reunion?.fecha || new Date().toISOString().slice(0, 10);
  }

  async save(): Promise<void> {
    if (!this.form.reunion_id || !this.form.status) {
      this.error.set('Completa reunión y estado.');
      return;
    }

    if (this.form.tipo === 'miembro' && !this.form.miembro_id) {
      this.error.set('Selecciona un miembro.');
      return;
    }

    if (this.form.tipo === 'invitado' && !this.form.invitado_id) {
      this.error.set('Selecciona un invitado.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const payload = {
      miembro_id: this.form.tipo === 'miembro' ? Number(this.form.miembro_id) : null,
      invitado_id: this.form.tipo === 'invitado' ? Number(this.form.invitado_id) : null,
      reunion_id: Number(this.form.reunion_id),
      fecha: this.obtenerFechaReunion(this.form.reunion_id),
      status: this.form.status,
    };

    try {
      if (this.editing) {
        await this.api.put(`/participantes/${this.editing.id}`, payload);
      } else {
        await this.api.post('/participantes', payload);
      }

      this.close();
      await this.load();
    } catch (error: any) {
      console.error('Error guardando participante:', error);
      this.error.set(this.extractError(error) || 'No se pudo guardar el participante.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: number): Promise<void> {
    if (!confirm('¿Seguro que deseas eliminar este participante?')) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.api.delete(`/participantes/${id}`);
      await this.load();
    } catch (error: any) {
      console.error('Error eliminando participante:', error);
      this.error.set(this.extractError(error) || 'No se pudo eliminar el participante.');
    } finally {
      this.loading.set(false);
    }
  }

  async marcarRetirado(item: any): Promise<void> {
    if (!confirm(`¿Marcar como retirado a ${this.nombreParticipante(item)}?`)) return;

    try {
      await this.api.put(`/participantes/${item.id}`, {
        miembro_id: item.miembro_id,
        invitado_id: item.invitado_id,
        reunion_id: item.reunion_id,
        fecha: item.fecha || this.obtenerFechaReunion(item.reunion_id),
        status: 'retirado',
      });

      await this.load();
    } catch (error: any) {
      console.error('Error marcando retirado:', error);
      this.error.set(this.extractError(error) || 'No se pudo retirar al participante.');
    }
  }

  async generarQr(item: any): Promise<void> {
    if (item.status === 'retirado') {
      this.error.set('No se puede generar QR para un participante retirado.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.qrImage = '';

    try {
      const res: any = await this.api.post('/qr/generar', {
        participante_id: item.id,
      });

      this.qrData = res?.data?.data ?? res?.data ?? res;

      if (this.qrData?.url) {
        this.qrImage = await QRCode.toDataURL(this.qrData.url, {
          width: 280,
          margin: 2,
        });
      }

      this.qrModal = true;
    } catch (error: any) {
      console.error('Error generando QR:', error);
      this.error.set(this.extractError(error) || 'No se pudo generar el QR.');
    } finally {
      this.saving.set(false);
    }
  }

  async copiarUrl(): Promise<void> {
    if (!this.qrData?.url) return;
    await navigator.clipboard.writeText(this.qrData.url);
    alert('URL copiada.');
  }

  async copiarToken(): Promise<void> {
    if (!this.qrData?.token) return;
    await navigator.clipboard.writeText(this.qrData.token);
    alert('Token copiado.');
  }

  abrirEsp32Virtual(): void {
    if (!this.qrData?.url) return;
    window.open(this.qrData.url, '_blank');
  }

  cerrarQr(): void {
    this.qrModal = false;
    this.qrData = null;
    this.qrImage = '';
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroStatus = '';
    this.filtroReunion = '';
  }

  nombreParticipante(item: any): string {
    return item?.miembro?.nombre || item?.invitado?.nombre || item?.nombre || 'Sin nombre';
  }

  tipoParticipante(item: any): string {
    if (item?.miembro_id || item?.miembro) return 'Miembro';
    if (item?.invitado_id || item?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(item: any): string {
    return item?.miembro?.rfid || item?.rfid || 'Sin RFID';
  }

  nombreReunion(item: any): string {
    return item?.reunion?.sesion || item?.reunion?.titulo || item?.reunion || 'Sin reunión';
  }

  badgeClass(status: string): string {
    const classes: Record<string, string> = {
      presente: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      ausente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      retirado: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      presente: 'Presente',
      ausente: 'Ausente',
      retirado: 'Retirado',
    };

    return labels[status] || status || 'Sin estado';
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

  private emptyForm(): any {
    return {
      tipo: 'miembro',
      miembro_id: '',
      invitado_id: '',
      reunion_id: '',
      status: 'presente',
    };
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