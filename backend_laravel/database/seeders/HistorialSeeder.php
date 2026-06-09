<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Historial;

class HistorialSeeder extends Seeder
{
    public function run(): void
    {
        Historial::create([
            'user_id' => 1,
            'operacion' => 'Inicio de sesión',
            'tabla' => 'users',
            'dato' => [
                'email' => 'admin@sistema.com',
                'fecha' => now(),
            ],
        ]);

        Historial::create([
            'user_id' => 1,
            'operacion' => 'Crear miembro',
            'tabla' => 'miembros',
            'dato' => [
                'id' => 1,
                'nombre' => 'Maria Lopez',
                'rfid' => 'RFID100',
                'baja' => 0,
            ],
        ]);

        Historial::create([
            'user_id' => 1,
            'operacion' => 'Crear reunión',
            'tabla' => 'reuniones',
            'dato' => [
                'id' => 1,
                'sesion' => 'Sesion Ordinaria',
                'status' => 'activa',
            ],
        ]);
    }
}