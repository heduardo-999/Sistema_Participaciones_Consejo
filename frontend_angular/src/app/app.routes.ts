import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

import { LayoutComponent } from './shared/components/layout/layout.component';

import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { MiembrosComponent } from './pages/miembros/miembros.component';
import { InvitadosComponent } from './pages/invitados/invitados.component';
import { ReunionesComponent } from './pages/reuniones/reuniones.component';
import { ParticipantesComponent } from './pages/participantes/participantes.component';
import { IntervencionesComponent } from './pages/intervenciones/intervenciones.component';
import { LugaresComponent } from './pages/lugares/lugares.component';
import { HistorialComponent } from './pages/historial/historial.component';
import { UsuariosComponent } from './pages/usuarios/usuarios.component';

import { QrEsp32Component } from './pages/qr-esp32/qr-esp32.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },

  {
    path: 'qr/esp32/:token',
    component: QrEsp32Component,
  },

  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard',
      },
      {
        path: 'miembros',
        component: MiembrosComponent,
        title: 'Miembros',
      },
      {
        path: 'invitados',
        component: InvitadosComponent,
        title: 'Invitados',
      },
      {
        path: 'reuniones',
        component: ReunionesComponent,
        title: 'Reuniones',
      },
      {
        path: 'participantes',
        component: ParticipantesComponent,
        title: 'Participantes',
      },
      {
        path: 'intervenciones',
        component: IntervencionesComponent,
        title: 'Intervenciones',
      },
      {
        path: 'lugares',
        component: LugaresComponent,
        title: 'Mapa de lugares',
      },
      {
        path: 'historial',
        component: HistorialComponent,
        title: 'Historial',
      },
      {
        path: 'usuarios',
        component: UsuariosComponent,
        title: 'Usuarios',
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'dashboard',
  },
];