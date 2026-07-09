<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuraciones_tiempos', function (Blueprint $table) {
            $table->id();
            $table->string('clave')->unique();
            $table->string('valor');
            $table->timestamps();
        });

        $now = now();
        DB::table('configuraciones_tiempos')->insert([
            [
                'clave' => 'tiempo_espera_entre_intervenciones_seg',
                'valor' => '10',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'clave' => 'tiempo_preparacion_intervencion_seg',
                'valor' => '10',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'clave' => 'tiempo_visualizacion_votacion_seg',
                'valor' => '7',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'clave' => 'tiempo_maximo_votacion_activa_seg',
                'valor' => '120',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('configuraciones_tiempos');
    }
};
