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

        DB::table('configuraciones_tiempos')->updateOrInsert(
            ['clave' => 'tiempo_preparacion_intervencion_seg'],
            ['valor' => '10', 'created_at' => now(), 'updated_at' => now()]
        );
    }

    public function down(): void
    {
        if (!Schema::hasTable('configuraciones_tiempos')) {
            return;
        }

        DB::table('configuraciones_tiempos')
            ->where('clave', 'tiempo_preparacion_intervencion_seg')
            ->delete();
    }
};
