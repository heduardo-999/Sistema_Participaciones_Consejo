<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        $actuales = DB::table('lugares')
            ->where('baja', 0)
            ->count();

        if ($actuales >= 40) {
            return;
        }

        for ($i = $actuales + 1; $i <= 40; $i++) {
            $mesaId = 'LUGAR-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);
            $espId = 'ESP32-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT);

            while (DB::table('lugares')->where('mesa_id', $mesaId)->exists()) {
                $mesaId = 'LUGAR-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4));
            }

            while (DB::table('lugares')->where('esp_id', $espId)->exists()) {
                $espId = 'ESP32-' . str_pad((string) $i, 2, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4));
            }

            DB::table('lugares')->insert([
                'mesa_id' => $mesaId,
                'esp_id' => $espId,
                'status' => 'funcional',
                'baja' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // No se eliminan lugares automáticamente para evitar perder asignaciones existentes.
    }
};
