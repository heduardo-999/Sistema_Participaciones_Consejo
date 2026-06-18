<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Participante;
use App\Models\Miembro;
use App\Models\Reunion;

class ParticipanteSeeder extends Seeder
{
    public function run(): void
    {
        $miembro = Miembro::where('rfid', 'RFID100')->first();
        $reunion = Reunion::where('sesion', 'Sesion Ordinaria')->first();

        if (!$miembro || !$reunion) {
            return;
        }

        Participante::updateOrCreate(
            [
                'miembro_id' => $miembro->id,
                'reunion_id' => $reunion->id,
            ],
            [
                'fecha' => now()->toDateString(),
                'status' => 'presente',
            ]
        );
    }
}
