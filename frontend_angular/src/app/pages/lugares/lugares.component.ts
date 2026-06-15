import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

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
  resumen = signal<any>({});
  selected = signal<any>(null);

  loading = signal(false);
  saving = signal(false);
  error = signal('');

  participante_id = '';
  nuevoStatus = '';

  topSeats = computed(() => this.lugaresOrdenados().slice(0, 10));
  rightSeats = computed(() => this.lugaresOrdenados().slice(10, 15));
  bottomSeats = computed(() => this.lugaresOrdenados().slice(15, 25).reverse());
  leftSeats = computed(() => this.lugaresOrdenados().slice(25, 30).reverse());

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [lugaresRes, asignadosRes, resumenRes, participantesRes]: any[] =
        await Promise.all([
          this.api.get('/lugares'),
          this.api.get('/lugares-asignados'),
          this.api.get('/lugares/resumen'),
          this.api.get('/participantes'),
        ]);

      this.lugares.set(this.normalizar(lugaresRes));
      this.asignados.set(this.normalizar(asignadosRes));
      this.resumen.set(resumenRes?.data ?? resumenRes ?? {});
      this.participantes.set(this.normalizar(participantesRes));
    } catch (error) {
      console.error('Error cargando lugares:', error);
      this.error.set('No se pudo cargar el mapa de lugares.');
    } finally {
      this.loading.set(false);
    }
  }

  puedeCambiarEstado(): boolean {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const role =
      user?.role ||
      user?.rol ||
      user?.roles?.[0]?.name ||
      user?.roles?.[0] ||
      '';

    return ['admin', 'super admin'].includes(String(role).toLowerCase());
  }

  lugaresOrdenados(): any[] {
    return [...this.lugares()].sort((a, b) => Number(a.id) - Number(b.id));
  }

  seleccionar(lugar: any): void {
    const asignacion = this.asignacionDeLugar(lugar.id);

    this.selected.set({
      ...lugar,
      asignacion,
    });

    this.participante_id = asignacion?.participante_id || '';
    this.nuevoStatus = lugar.status || 'funcional';
  }

  asignacionDeLugar(lugarId: number): any {
    return this.asignados().find(a => Number(a.lugar_id) === Number(lugarId));
  }

  participanteAsignado(lugar: any): any {
    const asignacion =
      lugar?.asignacion ||
      this.asignacionDeLugar(lugar.id);

    if (!asignacion) return null;

    return (
      asignacion.participante ||
      this.participantes().find(p => Number(p.id) === Number(asignacion.participante_id)) ||
      null
    );
  }

  nombreParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);

    return (
      participante?.miembro?.nombre ||
      participante?.invitado?.nombre ||
      participante?.nombre ||
      'Libre'
    );
  }

  rfidParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);
    return participante?.miembro?.rfid || 'Sin RFID';
  }

  estadoParticipantePorLugar(lugar: any): string {
    const participante = this.participanteAsignado(lugar);
    return participante?.status || 'sin participante';
  }

  estaOcupado(lugar: any): boolean {
    return !!this.asignacionDeLugar(lugar.id);
  }

  numeroLugar(lugar: any): string {
    return String(lugar.id).padStart(2, '0');
  }

  estadoVisual(lugar: any): string {
    if (lugar.status === 'denegado') return 'denegado';
    if (lugar.status === 'mantenimiento') return 'mantenimiento';
    if (lugar.status === 'dañada') return 'dañada';
    if (this.estaOcupado(lugar)) return 'ocupado';
    return 'disponible';
  }

  seatClass(lugar: any): string {
    const estado = this.estadoVisual(lugar);

    const classes: Record<string, string> = {
      disponible:
        'border-green-300 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300',
      ocupado:
        'border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300',
      mantenimiento:
        'border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-300',
      dañada:
        'border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300',
      denegado:
        'border-slate-400 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400',
    };

    return classes[estado];
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
      'sin participante': 'Sin participante',
    };

    return labels[status] || status || 'Sin estado';
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
      this.cerrarModal();
    } catch (error: any) {
      console.error('Error asignando lugar:', error);
      this.error.set(this.extractError(error) || 'No se pudo asignar el lugar.');
    } finally {
      this.saving.set(false);
    }
  }

async liberar(): Promise<void> {
  const lugar = this.selected();
  if (!lugar) return;

  const asignacion =
    lugar.asignacion ||
    this.asignados().find(a => Number(a.lugar_id) === Number(lugar.id));

  if (!asignacion?.id) {
    this.error.set('No se encontró una asignación activa para este lugar.');
    return;
  }

  if (!confirm('¿Liberar este lugar?')) return;

  this.saving.set(true);
  this.error.set('');

  try {
    await this.api.put(`/lugares-asignados/${asignacion.id}/liberar`, {});

    await this.load();
    this.cerrarModal();
  } catch (error: any) {
    console.error('Error liberando lugar:', error);
    this.error.set(this.extractError(error) || 'No se pudo liberar el lugar.');
  } finally {
    this.saving.set(false);
  }
}

  async cambiarEstado(): Promise<void> {
    const lugar = this.selected();
    if (!lugar) return;

    if (!this.puedeCambiarEstado()) {
      this.error.set('No tienes permiso para cambiar el estado del ESP32.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    try {
      await this.api.put(`/lugares/${lugar.id}`, {
        mesa_id: lugar.mesa_id,
        esp_id: lugar.esp_id,
        status: this.nuevoStatus,
      });

      await this.load();
      this.cerrarModal();
    } catch (error: any) {
      console.error('Error cambiando estado:', error);
      this.error.set(this.extractError(error) || 'No se pudo cambiar el estado del lugar.');
    } finally {
      this.saving.set(false);
    }
  }

  reiniciar(): void {
    alert('Temporizador reiniciado para este lugar.');
  }

  cerrarModal(): void {
    this.selected.set(null);
    this.participante_id = '';
    this.nuevoStatus = '';
  }

  participantesDisponibles(): any[] {
    const asignadosIds = this.asignados()
      .filter(a => Number(a.lugar_id) !== Number(this.selected()?.id))
      .map(a => Number(a.participante_id));

    return this.participantes().filter(p => {
      return p.status !== 'retirado' && !asignadosIds.includes(Number(p.id));
    });
  }

  nombreParticipante(participante: any): string {
    return (
      participante?.miembro?.nombre ||
      participante?.invitado?.nombre ||
      participante?.nombre ||
      'Sin nombre'
    );
  }

  tipoParticipante(participante: any): string {
    if (participante?.miembro) return 'Miembro';
    if (participante?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(participante: any): string {
    return participante?.miembro?.rfid || 'Sin RFID';
  }

  reunionParticipante(participante: any): string {
    return participante?.reunion?.sesion || 'Sin reunión';
  }

  private normalizar(res: any): any[] {
    const data = res?.data?.data ?? res?.data ?? res ?? [];
    return Array.isArray(data) ? data : [];
  }

  private extractError(error: any): string {
    const data = error?.response?.data;

    if (data?.message) return data.message;

    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      return data.errors[firstKey]?.[0] || 'Error de validación.';
    }

    return '';
  }
}