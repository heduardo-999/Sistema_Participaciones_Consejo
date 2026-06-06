<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('participantes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('miembro_id')
                ->nullable()
                ->constrained('miembros')
                ->nullOnDelete();

            $table->foreignId('invitado_id')
                ->nullable()
                ->constrained('invitados')
                ->nullOnDelete();

            $table->foreignId('reunion_id')
                ->constrained('reuniones')
                ->cascadeOnDelete();

            $table->date('fecha');

            $table->enum('status', [
                'presente',
                'retirado'
            ])->default('presente');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('participantes');
    }
};