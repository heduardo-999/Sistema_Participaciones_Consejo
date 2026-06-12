<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('token_qrs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('participante_id')
                ->constrained('participantes')
                ->cascadeOnDelete();

            $table->string('token')->unique();

            $table->timestamp('expires_at');

            $table->enum('status', [
                'activo',
                'expirado'
            ])->default('activo');

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('token_qrs');
    }
};
