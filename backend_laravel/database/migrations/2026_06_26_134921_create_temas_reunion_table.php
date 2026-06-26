<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('temas_reunion', function (Blueprint $table) {
            $table->id();

            $table->foreignId('reunion_id')
                ->constrained('reuniones')
                ->cascadeOnDelete();

            $table->string('titulo', 180);
            $table->text('descripcion')->nullable();

            $table->integer('orden')->default(1);

            $table->enum('status', [
                'pendiente',
                'en_curso',
                'completado'
            ])->default('pendiente');

            $table->timestamp('completado_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temas_reunion');
    }
};