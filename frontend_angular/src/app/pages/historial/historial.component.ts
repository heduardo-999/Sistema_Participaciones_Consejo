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
  participantes = signal<any[]>([]);
  selected = signal<any>(null);

  loading = signal(false);
  error = signal('');

  qInput = signal('');
  q = signal('');
  filtroTabla = signal('');

  page = signal(1);
  pageSize = 10;

  tablas = [
    'users',
    'miembros',
    'invitados',
    'reuniones',
    'participantes',
    'intervenciones',
    'lugares',
    'lugares_asignados',
    'token_qrs',
    'roles',
    'permissions',
    'roles_permissions',
    'menus',
    'role_menus',
  ];

  filteredItems = computed(() => {
    const search = this.normalizarTexto(this.q());
    const tabla = this.filtroTabla();

    return this.allItems().filter(item => {
      const textoBusqueda = this.normalizarTexto([
        this.usuario(item),
        this.email(item),
        this.nombreAfectado(item),
        item?.operacion,
        this.operacionTexto(item),
        item?.tabla,
        this.formatDate(item?.created_at),
        this.formatTime(item?.created_at),
        this.datoTexto(item),
      ].join(' '));

      const matchesSearch = !search || textoBusqueda.includes(search);
      const matchesTabla = !tabla || item.tabla === tabla;

      return matchesSearch && matchesTabla;
    });
  });

  items = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredItems().slice(start, start + this.pageSize);
  });

  total = computed(() => this.filteredItems().length);
  inicios = computed(() => this.allItems().filter(i => i.operacion === 'Inicio de sesión').length);
  cierres = computed(() => this.allItems().filter(i => i.operacion === 'Cierre de sesión').length);
  sistema = computed(() => this.allItems().filter(i => i.tabla !== 'users').length);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      await Promise.all([
        this.cargarHistorialCompleto(),
        this.cargarParticipantes(),
      ]);

      this.page.set(1);
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.error.set('No se pudo cargar el historial.');
      this.allItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async cargarHistorialCompleto(): Promise<void> {
    const acumulado: any[] = [];

    const firstRes: any = await this.api.get('/historial?page=1');
    const firstPaginator = this.extraerPaginador(firstRes);

    acumulado.push(...this.extraerDataPaginada(firstPaginator));

    const lastPage = Number(firstPaginator?.last_page || 1);

    for (let pagina = 2; pagina <= lastPage; pagina++) {
      const res: any = await this.api.get(`/historial?page=${pagina}`);
      const paginator = this.extraerPaginador(res);

      acumulado.push(...this.extraerDataPaginada(paginator));
    }

    this.allItems.set(
      acumulado.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
  }

  async cargarParticipantes(): Promise<void> {
    try {
      const res: any = await this.api.get('/participantes');
      const data = res?.data?.data ?? res?.data ?? res ?? [];

      this.participantes.set(Array.isArray(data) ? data : []);
    } catch {
      this.participantes.set([]);
    }
  }

  buscar(): void {
    this.q.set(this.qInput().trim());
    this.page.set(1);
  }

  limpiarFiltros(): void {
    this.qInput.set('');
    this.q.set('');
    this.filtroTabla.set('');
    this.page.set(1);
  }

  abrirDetalle(item: any): void {
    this.selected.set(item);
  }

  cerrarDetalle(): void {
    this.selected.set(null);
  }

  cambiarPagina(pagina: number): void {
    if (!pagina || pagina < 1 || pagina > this.lastPage()) return;
    this.page.set(pagina);
  }

  lastPage(): number {
    return Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize));
  }

  pages(): number[] {
    const last = this.lastPage();
    const current = this.page();

    const start = Math.max(1, current - 2);
    const end = Math.min(last, current + 2);

    const pages: number[] = [];

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  usuario(item: any): string {
    return item?.user?.name || 'Sin usuario';
  }

  email(item: any): string {
    return item?.user?.email || item?.dato?.email || 'Sin correo';
  }

  nombreAfectado(item: any): string {
    const dato = item?.dato || {};

    if (typeof dato.participante === 'string') return dato.participante;
    if (typeof dato.miembro === 'string') return dato.miembro;
    if (typeof dato.invitado === 'string') return dato.invitado;

    const nombreDirecto =
      dato.rol ||
      dato.nombre ||
      dato.menu ||
      dato.permiso ||
      dato.participante_nombre ||
      dato.miembro_nombre ||
      dato.invitado_nombre ||
      dato.participante?.miembro?.nombre ||
      dato.participante?.invitado?.nombre ||
      dato.miembro?.nombre ||
      dato.invitado?.nombre ||
      dato.antes?.nombre ||
      dato.despues?.nombre ||
      dato.antes?.participante_nombre ||
      dato.despues?.participante_nombre ||
      dato.antes?.participante?.miembro?.nombre ||
      dato.antes?.participante?.invitado?.nombre ||
      dato.despues?.participante?.miembro?.nombre ||
      dato.despues?.participante?.invitado?.nombre ||
      dato.lugar?.participante?.miembro?.nombre ||
      dato.lugar?.participante?.invitado?.nombre;

    if (nombreDirecto) return nombreDirecto;

    const participanteId =
      dato.participante_id ||
      dato.antes?.participante_id ||
      dato.despues?.participante_id;

    if (participanteId) {
      const participante = this.participantes().find(
        p => String(p.id) === String(participanteId)
      );

      const nombre = participante?.miembro?.nombre || participante?.invitado?.nombre;

      return nombre || `Participante ID ${participanteId}`;
    }

    return 'Sin afectado';
  }

  operacionTexto(item: any): string {
    const op = String(item?.operacion || '');

    const texto: Record<string, string> = {
      'Crear lugar asignado': 'Asignación de lugar',
      'Asignar lugar': 'Asignación de lugar',
      'Liberar lugar': 'Liberación de lugar',
      'Dar de baja miembro': 'Baja de miembro',
      'Reactivar miembro': 'Reactivación de miembro',
      'Solicitud de intervención por QR': 'Solicitud de intervención',
      'Cancelar intervención por QR': 'Cancelación de intervención',
      'Finalizar intervención por QR': 'Finalización de intervención',
      'Generar QR temporal': 'Generación de QR temporal',
      'Iniciar reunión': 'Inicio de reunión',
      'Terminar reunión': 'Fin de reunión',

      'Crear rol': 'Creación de rol',
      'Eliminar rol': 'Eliminación de rol',
      'Crear permiso': 'Creación de permiso',
      'Eliminar permiso': 'Eliminación de permiso',
      'Actualizar permisos de rol': 'Actualización de permisos del rol',
      'Crear menú': 'Creación de menú',
      'Actualizar menú': 'Actualización de menú',
      'Eliminar menú': 'Eliminación de menú',
      'Actualizar menús de rol': 'Actualización de menús del rol',
    };

    return texto[op] || op || 'Sin operación';
  }

  operacionClass(operacion: string): string {
    const op = String(operacion || '').toLowerCase();

    if (op.includes('inicio') || op.includes('crear') || op.includes('generar') || op.includes('solicitud') || op.includes('creación')) {
      return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
    }

    if (op.includes('cierre') || op.includes('terminar') || op.includes('finalizar') || op.includes('liberar')) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }

    if (op.includes('baja') || op.includes('eliminar') || op.includes('eliminación') || op.includes('cancelar')) {
      return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
    }

    if (op.includes('actualizar') || op.includes('actualización') || op.includes('editar') || op.includes('reactivar')) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }

    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  datoTexto(item: any): string {
    const dato = item?.dato;

    if (!dato) return 'Sin dato registrado';

    try {
      if (typeof dato === 'string') {
        const parsed = JSON.parse(dato);
        return JSON.stringify(parsed, null, 2);
      }

      return JSON.stringify(dato, null, 2);
    } catch {
      return String(dato);
    }
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
    if (!fecha) return '--:--';

    const date = new Date(fecha);
    if (isNaN(date.getTime())) return '--:--';

    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private normalizarTexto(texto: string): string {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private extraerPaginador(res: any): any {
    return res?.data ?? {};
  }

  private extraerDataPaginada(paginator: any): any[] {
    return Array.isArray(paginator?.data)
      ? paginator.data
      : [];
  }
}