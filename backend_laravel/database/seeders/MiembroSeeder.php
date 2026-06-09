<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Miembro;

class MiembroSeeder extends Seeder
{
    public function run(): void
    {
        Miembro::create([
            'nombre' => 'Maria Lopez',
            'fecha' => now()->toDateString(),
            'baja' => 0,
            'rfid' => 'RFID100'
        ]);

        Miembro::create([
            'nombre' => 'Juan Perez',
            'fecha' => now()->toDateString(),
            'baja' => 0,
            'rfid' => 'RFID101'
        ]);
    }
}
