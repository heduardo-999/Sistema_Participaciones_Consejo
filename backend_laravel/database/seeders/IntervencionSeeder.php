<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Intervencion;

class IntervencionSeeder extends Seeder
{
    public function run(): void
    {
        Intervencion::create([
            'participante_id' => 1,
            'solicita_intervencion' => true,
            'hora_inicio' => '10:05',
            'hora_fin' => '10:15',
            'status' => 'interviniendo',
        ]);
    }
}
