<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $superAdmin = Role::firstOrCreate(['name' => 'super admin']);
        $admin = Role::firstOrCreate(['name' => 'admin']);
        $moderador = Role::firstOrCreate(['name' => 'moderador']);

        $modulos = [
            'users',
            'miembros',
            'invitados',
            'reuniones',
            'participantes',
            'intervenciones',
            'historial',
        ];

        $acciones = [
            'view',
            'create',
            'edit',
            'delete',
        ];

        foreach ($modulos as $modulo) {
            foreach ($acciones as $accion) {
                Permission::firstOrCreate([
                    'name' => "{$modulo}.{$accion}",
                ]);
            }
        }

        $superAdmin->syncPermissions(Permission::all());

        $admin->syncPermissions([
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',

            'miembros.view',
            'miembros.create',
            'miembros.edit',
            'miembros.delete',

            'invitados.view',
            'invitados.create',
            'invitados.edit',
            'invitados.delete',

            'reuniones.view',
            'reuniones.create',
            'reuniones.edit',
            'reuniones.delete',

            'participantes.view',
            'participantes.create',
            'participantes.edit',
            'participantes.delete',

            'intervenciones.view',
            'intervenciones.create',
            'intervenciones.edit',
            'intervenciones.delete',

            'historial.view',
        ]);

        $moderador->syncPermissions([
            'miembros.view',
            'miembros.create',
            'miembros.edit',
            'miembros.delete',

            'invitados.view',
            'invitados.create',
            'invitados.edit',
            'invitados.delete',

            'reuniones.view',
            'reuniones.create',
            'reuniones.edit',
            'reuniones.delete',

            'intervenciones.view',
            'intervenciones.create',
            'intervenciones.edit',
            'intervenciones.delete',

            'participantes.view',
            'historial.view',
        ]);
    }
}