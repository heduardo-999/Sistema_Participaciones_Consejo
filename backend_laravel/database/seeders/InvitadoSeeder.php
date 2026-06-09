<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Invitado;

class InvitadoSeeder extends Seeder
{
    public function run(): void
    {
        Invitado::create([
            'nombre' => 'Carlos Ramirez',
            'fecha_participacion' => now()->toDateString(),
        ]);

        Invitado::create([
            'nombre' => 'Ana Torres',
            'fecha_participacion' => now()->toDateString(),
        ]);
    }
}
