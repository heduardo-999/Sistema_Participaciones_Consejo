<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intervenciones', function (Blueprint $table) {
            if (!Schema::hasColumn('intervenciones', 'preparacion_inicia_at')) {
                $table->timestamp('preparacion_inicia_at')
                    ->nullable()
                    ->after('hora_fin');
            }
        });

        DB::statement("
            ALTER TABLE intervenciones
            MODIFY status ENUM(
                'no intervino',
                'aun no intervino',
                'preparando',
                'interviniendo',
                'fin intervencion'
            ) NOT NULL DEFAULT 'aun no intervino'
        ");
    }

    public function down(): void
    {
        DB::statement("
            UPDATE intervenciones
            SET status = 'aun no intervino'
            WHERE status = 'preparando'
        ");

        Schema::table('intervenciones', function (Blueprint $table) {
            if (Schema::hasColumn('intervenciones', 'preparacion_inicia_at')) {
                $table->dropColumn('preparacion_inicia_at');
            }
        });

        DB::statement("
            ALTER TABLE intervenciones
            MODIFY status ENUM(
                'no intervino',
                'aun no intervino',
                'interviniendo',
                'fin intervencion'
            ) NOT NULL DEFAULT 'aun no intervino'
        ");
    }
};
