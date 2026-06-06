<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('intervenciones', function (Blueprint $table) {
            $table->id();

            $table->foreignId('participante_id')
                ->constrained('participantes')
                ->cascadeOnDelete();

            $table->boolean('solicita_intervencion')->default(false);

            $table->time('hora_inicio')->nullable();
            $table->time('hora_fin')->nullable();

            $table->enum('status', [
                'no intervino',
                'aun no intervino',
                'interviniendo',
                'fin intervencion'
            ])->default('aun no intervino');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('intervenciones');
    }
};
