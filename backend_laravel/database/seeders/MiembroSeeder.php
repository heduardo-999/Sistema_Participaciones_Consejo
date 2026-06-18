<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Miembro;

class MiembroSeeder extends Seeder
{
    public function run(): void
    {
        $miembros = [
            [
                'nombre' => 'Maria Lopez',
                'fecha' => now()->toDateString(),
                'baja' => 0,
                'rfid' => 'RFID100',
            ],
            [
                'nombre' => 'Juan Perez',
                'fecha' => now()->toDateString(),
                'baja' => 0,
                'rfid' => 'RFID101',
            ],
        ];

        foreach ($miembros as $miembro) {
            Miembro::updateOrCreate(
                ['rfid' => $miembro['rfid']],
                $miembro
            );
        }
    }
}
