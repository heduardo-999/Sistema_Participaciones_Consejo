import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-intervenciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './intervenciones.component.html',
})
export class IntervencionesComponent implements OnInit, OnDestroy {
  allItems = signal<any[]>([]);
  loading = signal(false);
  error = signal('');

  private refreshId: any = null;

  items = computed(() => {
    return this.allItems()
      .filter(item =>
        ['aun no intervino', 'interviniendo'].includes(item.status)
      )
      .sort((a, b) => {
        const order: Record<string, number> = {
          interviniendo: 1,
          'aun no intervino': 2,
        };

        const statusA = order[a.status] ?? 99;
        const statusB = order[b.status] ?? 99;

        if (statusA !== statusB) return statusA - statusB;

        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      });
  });

  intervencionActual = computed(() => {
    return this.items().find(item => item.status === 'interviniendo') ?? null;
  });

  cola = computed(() => {
    return this.items().filter(item => item.status === 'aun no intervino');
  });

  proxima = computed(() => {
    return this.cola()[0] ?? null;
  });

  totalCola = computed(() => this.cola().length);

  reunionesActivas = computed(() => {
    return this.items().filter(item => item?.participante?.reunion?.status === 'activa').length;
  });

  reunionesNoActivas = computed(() => {
    return this.items().filter(item => item?.participante?.reunion?.status !== 'activa').length;
  });

  miembros = computed(() => {
    return this.items().filter(item => item?.participante?.miembro).length;
  });

  invitados = computed(() => {
    return this.items().filter(item => item?.participante?.invitado).length;
  });

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.load();

    this.refreshId = setInterval(() => {
      this.load(false);
    }, 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.refreshId);
  }

  async load(showLoading = true): Promise<void> {
    if (showLoading) this.loading.set(true);
    this.error.set('');

    try {
      const res: any = await this.api.get('/intervenciones');
      const data = res?.data?.data ?? res?.data ?? res ?? [];
      this.allItems.set(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando intervenciones:', error);
      this.error.set('No se pudieron cargar las intervenciones.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  nombreParticipante(item: any): string {
    return (
      item?.participante?.miembro?.nombre ||
      item?.participante?.invitado?.nombre ||
      'Sin participante'
    );
  }

  tipoParticipante(item: any): string {
    if (item?.participante?.miembro) return 'Miembro';
    if (item?.participante?.invitado) return 'Invitado';
    return 'Participante';
  }

  rfidParticipante(item: any): string {
    return item?.participante?.miembro?.rfid || 'Sin RFID';
  }

  nombreReunion(item: any): string {
    return item?.participante?.reunion?.sesion || 'Sin reunión';
  }

  estadoReunion(item: any): string {
    return item?.participante?.reunion?.status || 'sin estado';
  }

  fechaReunion(item: any): string {
    return this.formatDate(item?.participante?.reunion?.fecha);
  }

  horaReunion(item: any): string {
    const inicio = item?.participante?.reunion?.hora_inicio;
    const fin = item?.participante?.reunion?.hora_fin;

    if (!inicio && !fin) return 'Sin horario';

    return `${this.formatTime(inicio)} - ${this.formatTime(fin)}`;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      'aun no intervino': 'En cola',
      interviniendo: 'Interviniendo',
      'fin intervencion': 'Finalizada',
    };

    return labels[status] || status || 'Sin estado';
  }

  statusClass(status: string): string {
    const classes: Record<string, string> = {
      'aun no intervino': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      interviniendo: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      'fin intervencion': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  reunionClass(status: string): string {
    const classes: Record<string, string> = {
      activa: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      pospuesta: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
      terminada: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      cancelada: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    };

    return classes[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  reunionLabel(status: string): string {
    const labels: Record<string, string> = {
      activa: 'Activa',
      pospuesta: 'Pospuesta',
      terminada: 'Terminada',
      cancelada: 'Cancelada',
    };

    return labels[status] || status || 'Sin estado';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const partes = fecha.toString().split('T')[0].split('-');

    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    return fecha;
  }

  formatTime(hora: string): string {
    if (!hora) return 'Sin hora';
    return hora.toString().slice(0, 5);
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
}