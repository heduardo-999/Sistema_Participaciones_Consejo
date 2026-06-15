import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.component.html',
})
export class HistorialComponent implements OnInit {
  allItems = signal<any[]>([]);
  pagination = signal<any>({});
  selected = signal<any>(null);

  loading = signal(false);
  error = signal('');

  q = '';
  filtroTabla = '';
  filtroOperacion = '';
  page = 1;

  tablas = [
    'users',
    'miembros',
    'invitados',
    'reuniones',
    'participantes',
    'intervenciones',
    'lugares',
    'lugares_asignados',
  ];

  items = computed(() => {
    const search = this.q.trim().toLowerCase();
    const tabla = this.filtroTabla;
    const operacion = this.filtroOperacion.trim().toLowerCase();

    return this.allItems().filter(item => {
      const usuario = String(item.user?.name || '').toLowerCase();
      const email = String(item.user?.email || item.dato?.email || '').toLowerCase();
      const op = String(item.operacion || '').toLowerCase();
      const table = String(item.tabla || '').toLowerCase();

      const matchesSearch =
        !search ||
        usuario.includes(search) ||
        email.includes(search) ||
        op.includes(search) ||
        table.includes(search);

      const matchesTabla = !tabla || item.tabla === tabla;
      const matchesOperacion = !operacion || op.includes(operacion);

      return matchesSearch && matchesTabla && matchesOperacion;
    });
  });

  total = computed(() => this.pagination()?.total || this.allItems().length);
  inicios = computed(() => this.allItems().filter(i => i.operacion === 'Inicio de sesión').length);
  cierres = computed(() => this.allItems().filter(i => i.operacion === 'Cierre de sesión').length);
  sistema = computed(() => this.allItems().filter(i => i.tabla !== 'users').length);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(page = this.page): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.page = page;

    try {
      const res: any = await this.api.get(`/historial?page=${page}`);
      const paginated = res?.data ?? res ?? {};
      const data = paginated?.data ?? [];

      this.allItems.set(Array.isArray(data) ? data : []);
      this.pagination.set(paginated);
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.error.set('No se pudo cargar el historial.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  limpiarFiltros(): void {
    this.q = '';
    this.filtroTabla = '';
    this.filtroOperacion = '';
  }

  abrirDetalle(item: any): void {
    this.selected.set(item);
  }

  cerrarDetalle(): void {
    this.selected.set(null);
  }

  cambiarPagina(page: number): void {
    if (!page || page < 1 || page > this.lastPage()) return;
    this.load(page);
  }

  lastPage(): number {
    return Number(this.pagination()?.last_page || 1);
  }

  pages(): number[] {
    const last = this.lastPage();
    const current = this.page;
    const start = Math.max(1, current - 2);
    const end = Math.min(last, current + 2);

    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);

    return pages;
  }

  usuario(item: any): string {
    return item?.user?.name || 'Sin usuario';
  }

  email(item: any): string {
    return item?.user?.email || item?.dato?.email || 'Sin correo';
  }

  formatDate(fecha: string): string {
    if (!fecha) return 'Sin fecha';

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;

    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatTime(fecha: string): string {
    if (!fecha) return 'Sin hora';

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha;

    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  operacionClass(operacion: string): string {
    const op = String(operacion || '').toLowerCase();

    if (op.includes('inicio')) {
      return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
    }

    if (op.includes('cierre')) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }

    if (op.includes('eliminar') || op.includes('baja')) {
      return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    }

    if (op.includes('actualizar') || op.includes('editar')) {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300';
    }

    if (op.includes('crear') || op.includes('asignar') || op.includes('reactivar')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }

    return 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  }

  datoTexto(item: any): string {
    try {
      return JSON.stringify(item?.dato ?? {}, null, 2);
    } catch {
      return 'Sin datos';
    }
  }
}