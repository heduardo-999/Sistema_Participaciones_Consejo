<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Lugar;

class LugarSeeder extends Seeder
{
    public function run(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $numero = str_pad($i, 2, '0', STR_PAD_LEFT);
            $espNumero = str_pad($i, 3, '0', STR_PAD_LEFT);

            Lugar::updateOrCreate(
                ['mesa_id' => 'MESA-01-' . $numero],
                [
                    'esp_id' => 'ESP32-' . $espNumero,
                    'status' => 'funcional',
                    'baja' => 0,
                ]
            );
        }
    }
}
