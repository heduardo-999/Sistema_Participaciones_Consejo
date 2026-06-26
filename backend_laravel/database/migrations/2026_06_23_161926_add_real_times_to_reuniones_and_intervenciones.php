<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            $table->timestamp('inicio_real_at')->nullable()->after('hora_fin');
            $table->timestamp('fin_real_at')->nullable()->after('inicio_real_at');
        });

        Schema::table('intervenciones', function (Blueprint $table) {
            $table->timestamp('inicio_real_at')->nullable()->after('hora_fin');
            $table->timestamp('fin_real_at')->nullable()->after('inicio_real_at');
        });
    }

    public function down(): void
    {
        Schema::table('reuniones', function (Blueprint $table) {
            $table->dropColumn(['inicio_real_at', 'fin_real_at']);
        });

        Schema::table('intervenciones', function (Blueprint $table) {
            $table->dropColumn(['inicio_real_at', 'fin_real_at']);
        });
    }
};