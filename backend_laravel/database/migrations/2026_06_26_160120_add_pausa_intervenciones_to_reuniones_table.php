<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            if (!Schema::hasColumn('reuniones', 'intervenciones_pausadas')) {
                $table->boolean('intervenciones_pausadas')
                    ->default(false)
                    ->after('fin_real_at');
            }

            if (!Schema::hasColumn('reuniones', 'intervenciones_pausadas_at')) {
                $table->timestamp('intervenciones_pausadas_at')
                    ->nullable()
                    ->after('intervenciones_pausadas');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            if (Schema::hasColumn('reuniones', 'intervenciones_pausadas_at')) {
                $table->dropColumn('intervenciones_pausadas_at');
            }

            if (Schema::hasColumn('reuniones', 'intervenciones_pausadas')) {
                $table->dropColumn('intervenciones_pausadas');
            }
        });
    }
};