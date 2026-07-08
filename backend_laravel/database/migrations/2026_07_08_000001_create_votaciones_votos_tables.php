<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('votaciones')) {
            Schema::create('votaciones', function (Blueprint $table) {
                $table->id();
                $table->foreignId('reunion_id')->constrained('reuniones')->cascadeOnDelete();
                $table->string('nombre', 150)->nullable();
                $table->enum('status', ['activa', 'finalizada', 'guardada'])->default('activa');
                $table->boolean('incluir_invitados')->default(false);
                $table->foreignId('iniciada_por')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('iniciada_at')->nullable();
                $table->timestamp('finalizada_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('votos')) {
            Schema::create('votos', function (Blueprint $table) {
                $table->id();
                $table->foreignId('votacion_id')->constrained('votaciones')->cascadeOnDelete();
                $table->foreignId('participante_id')->constrained('participantes')->cascadeOnDelete();
                $table->enum('voto', ['si', 'no', 'abstencion']);
                $table->timestamp('votado_at')->nullable();
                $table->timestamps();

                $table->unique(['votacion_id', 'participante_id'], 'votos_votacion_participante_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('votos');
        Schema::dropIfExists('votaciones');
    }
};
