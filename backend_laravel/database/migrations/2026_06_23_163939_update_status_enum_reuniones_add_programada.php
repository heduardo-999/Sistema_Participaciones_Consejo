<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE reuniones
            MODIFY status ENUM('programada', 'activa', 'terminada', 'cancelada', 'pospuesta')
            NOT NULL DEFAULT 'programada'
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE reuniones
            MODIFY status ENUM('activa', 'terminada', 'cancelada', 'pospuesta')
            NOT NULL DEFAULT 'activa'
        ");
    }
};