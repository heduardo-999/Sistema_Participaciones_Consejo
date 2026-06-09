<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Participante;

class ParticipanteSeeder extends Seeder
{
    public function run(): void
    {
        Participante::create([
            'miembro_id' => 1,
            'reunion_id' => 1,
            'fecha' => now()->toDateString(),
            'status' => 'presente',
        ]);
    }
}