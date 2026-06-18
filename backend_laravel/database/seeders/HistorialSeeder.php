<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Historial;

class HistorialSeeder extends Seeder
{
    public function run(): void
    {
        $historiales = [
            [
                'user_id' => 1,
                'operacion' => 'Inicio de sesión',
                'tabla' => 'users',
                'dato' => [
                    'email' => 'admin@sistema.com',
                    'fecha' => now()->toDateTimeString(),
                ],
            ],
            [
                'user_id' => 1,
                'operacion' => 'Crear miembro',
                'tabla' => 'miembros',
                'dato' => [
                    'nombre' => 'Maria Lopez',
                    'rfid' => 'RFID100',
                    'baja' => 0,
                ],
            ],
            [
                'user_id' => 1,
                'operacion' => 'Crear reunión',
                'tabla' => 'reuniones',
                'dato' => [
                    'sesion' => 'Sesion Ordinaria',
                    'status' => 'activa',
                ],
            ],
        ];

        foreach ($historiales as $historial) {
            Historial::updateOrCreate(
                [
                    'user_id' => $historial['user_id'],
                    'operacion' => $historial['operacion'],
                    'tabla' => $historial['tabla'],
                ],
                $historial
            );
        }
    }
}
