<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Lugar;

class LugarSeeder extends Seeder
{
    public function run(): void
    {
        for ($i = 1; $i <= 30; $i++) {

            Lugar::create([
                'mesa_id' => 'MESA-01-' . str_pad($i, 2, '0', STR_PAD_LEFT),
                'esp_id' => 'ESP32-' . str_pad($i, 3, '0', STR_PAD_LEFT),
                'status' => 'funcional',
                'baja' => 0,
            ]);
        }
    }
}