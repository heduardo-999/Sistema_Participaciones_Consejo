<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Invitado;

class InvitadoSeeder extends Seeder
{
    public function run(): void
    {
        $invitados = [
            [
                'nombre' => 'Carlos Ramirez',
                'fecha_participacion' => now()->toDateString(),
            ],
            [
                'nombre' => 'Ana Torres',
                'fecha_participacion' => now()->toDateString(),
            ],
        ];

        foreach ($invitados as $invitado) {
            Invitado::updateOrCreate(
                ['nombre' => $invitado['nombre']],
                $invitado
            );
        }
    }
}
