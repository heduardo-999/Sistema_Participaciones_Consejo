<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

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
                $permiso = Permission::firstOrCreate([
                    'name' => "{$modulo}.{$accion}",
                ]);

                $permiso->syncRoles([$superAdmin]);

                if ($accion !== 'delete') {
                    $permiso->assignRole($admin);
                }

                if ($accion === 'view') {
                    $permiso->assignRole($moderador);
                }
            }
        }
    }
}