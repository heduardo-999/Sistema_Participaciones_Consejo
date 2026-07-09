<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('configuraciones_tiempos')) {
            return;
        }

        $now = now();
        $defaults = [
            'tiempo_preparacion_intervencion_seg' => '10',
            'tiempo_intervencion_seg' => '300',
            'tiempo_visualizacion_votacion_seg' => '7',
            'tiempo_maximo_votacion_activa_seg' => '120',
            'tiempo_espera_entre_intervenciones_seg' => '10',
        ];

        foreach ($defaults as $clave => $valor) {
            $existe = DB::table('configuraciones_tiempos')->where('clave', $clave)->exists();

            if (!$existe) {
                DB::table('configuraciones_tiempos')->insert([
                    'clave' => $clave,
                    'valor' => $valor,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // No se eliminan claves para no perder configuración del usuario.
    }
};
