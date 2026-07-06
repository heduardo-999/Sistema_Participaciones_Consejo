<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            if (!Schema::hasColumn('reuniones', 'intervenciones_automaticas')) {
                $table->boolean('intervenciones_automaticas')
                    ->default(false)
                    ->after('intervenciones_pausadas_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            if (Schema::hasColumn('reuniones', 'intervenciones_automaticas')) {
                $table->dropColumn('intervenciones_automaticas');
            }
        });
    }
};
