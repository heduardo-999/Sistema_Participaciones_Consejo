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
                '/intervenciones',
                '/historial',
                '/lugares',
                '/lugares-asignados',
            ],
            'visualizador' => [
                '/dashboard',
            ],
        ];

        foreach ($menusPorRol as $nombreRol => $urls) {
            $rol = Role::where('name', $nombreRol)->first();

            if (!$rol) {
                continue;
            }

            DB::table('role_menus')
                ->where('role_id', $rol->id)
                ->delete();

            $menus = Menu::whereIn('url', $urls)
                ->where('baja', 0)
                ->get();

            foreach ($menus as $menu) {
                DB::table('role_menus')->insert([
                    'role_id' => $rol->id,
                    'menu_id' => $menu->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
