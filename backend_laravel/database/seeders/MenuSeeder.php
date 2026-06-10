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
                'icono' => 'dashboard',
                'baja' => 0,
            ],
            [
                'nombre' => 'Usuarios',
                'url' => '/usuarios',
                'icono' => 'users',
                'baja' => 0,
            ],
            [
                'nombre' => 'Miembros',
                'url' => '/miembros',
                'icono' => 'user-check',
                'baja' => 0,
            ],
            [
                'nombre' => 'Invitados',
                'url' => '/invitados',
                'icono' => 'user-plus',
                'baja' => 0,
            ],
            [
                'nombre' => 'Reuniones',
                'url' => '/reuniones',
                'icono' => 'calendar',
                'baja' => 0,
            ],
            [
                'nombre' => 'Participantes',
                'url' => '/participantes',
                'icono' => 'users',
                'baja' => 0,
            ],
            [
                'nombre' => 'Intervenciones',
                'url' => '/intervenciones',
                'icono' => 'mic',
                'baja' => 0,
            ],
            [
                'nombre' => 'Historial',
                'url' => '/historial',
                'icono' => 'history',
                'baja' => 0,
            ],
            [
                'nombre' => 'Lugares',
                'url' => '/lugares',
                'icono' => 'map-pin',
                'baja' => 0,
            ],
            [
                'nombre' => 'Lugares Asignados',
                'url' => '/lugares-asignados',
                'icono' => 'layout',
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