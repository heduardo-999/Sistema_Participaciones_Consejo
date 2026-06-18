<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use App\Models\Menu;

class RoleMenuSeeder extends Seeder
{
    public function run(): void
    {
        $menusPorRol = [
            'super admin' => [
                '/dashboard',
                '/usuarios',
                '/miembros',
                '/invitados',
                '/reuniones',
                '/participantes',
                '/intervenciones',
                '/historial',
                '/lugares',
                '/lugares-asignados',
                '/menus-roles',
                '/roles-permisos',
            ],
            'admin' => [
                '/dashboard',
                '/usuarios',
                '/miembros',
                '/invitados',
                '/reuniones',
                '/participantes',
                '/intervenciones',
                '/historial',
                '/lugares',
                '/lugares-asignados',
            ],
            'moderador' => [
                '/dashboard',
                '/miembros',
                '/invitados',
                '/reuniones',
                '/participantes',
                '/intervenciones',
                '/historial',
                '/lugares',
                '/lugares-asignados',
            ],
        ];

        foreach ($menusPorRol as $nombreRol => $urls) {
            $rol = Role::where('name', $nombreRol)->first();

            if (!$rol) {
                continue;
            }

            $menus = Menu::whereIn('url', $urls)
                ->where('baja', 0)
                ->get();

            foreach ($menus as $menu) {
                DB::table('role_menus')->updateOrInsert(
                    [
                        'role_id' => $rol->id,
                        'menu_id' => $menu->id,
                    ],
                    [
                        'updated_at' => now(),
                        'created_at' => DB::raw('COALESCE(created_at, NOW())'),
                    ]
                );
            }
        }
    }
}
