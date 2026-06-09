<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Reunion;

class ReunionSeeder extends Seeder
{
    public function run(): void
    {
        Reunion::create([
            'sesion' => 'Sesion Ordinaria',
            'fecha' => now()->toDateString(),
            'status' => 'activa',
            'hora_inicio' => '10:00',
            'hora_fin' => '12:00',
        ]);
    }
}