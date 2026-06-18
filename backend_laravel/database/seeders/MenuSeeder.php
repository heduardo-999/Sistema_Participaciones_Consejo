<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Menu;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $menus = [
            [
                'nombre' => 'Dashboard',
                'url' => '/dashboard',
                'icono' => '🏠',
                'baja' => 0,
            ],
            [
                'nombre' => 'Usuarios',
                'url' => '/usuarios',
                'icono' => '👤',
                'baja' => 0,
            ],
            [
                'nombre' => 'Miembros',
                'url' => '/miembros',
                'icono' => '👥',
                'baja' => 0,
            ],
            [
                'nombre' => 'Invitados',
                'url' => '/invitados',
                'icono' => '➕',
                'baja' => 0,
            ],
            [
                'nombre' => 'Reuniones',
                'url' => '/reuniones',
                'icono' => '📅',
                'baja' => 0,
            ],
            [
                'nombre' => 'Participantes',
                'url' => '/participantes',
                'icono' => '🪪',
                'baja' => 0,
            ],
            [
                'nombre' => 'Intervenciones',
                'url' => '/intervenciones',
                'icono' => '🎙️',
                'baja' => 0,
            ],
            [
                'nombre' => 'Historial',
                'url' => '/historial',
                'icono' => '📜',
                'baja' => 0,
            ],
            [
                'nombre' => 'Lugares',
                'url' => '/lugares',
                'icono' => '📍',
                'baja' => 0,
            ],
            [
                'nombre' => 'Lugares Asignados',
                'url' => '/lugares-asignados',
                'icono' => '🪑',
                'baja' => 0,
            ],
            [
                'nombre' => 'Menús Roles',
                'url' => '/menus-roles',
                'icono' => '⚙️',
                'baja' => 0,
            ],
            [
                'nombre' => 'Roles Permisos',
                'url' => '/roles-permisos',
                'icono' => '🛡️',
                'baja' => 0,
            ],
        ];

        foreach ($menus as $menu) {
            Menu::updateOrCreate(
                ['url' => $menu['url']],
                $menu
            );
        }
    }
}
