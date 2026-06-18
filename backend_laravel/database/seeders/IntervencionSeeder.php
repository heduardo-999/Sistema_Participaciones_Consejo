<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Intervencion;
use App\Models\Participante;

class IntervencionSeeder extends Seeder
{
    public function run(): void
    {
        $participante = Participante::first();

        if (!$participante) {
            return;
        }

        Intervencion::updateOrCreate(
            ['participante_id' => $participante->id],
            [
                'solicita_intervencion' => true,
                'hora_inicio' => '10:05',
                'hora_fin' => '10:15',
                'status' => 'interviniendo',
            ]
        );
    }
}
