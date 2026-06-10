<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up(): void
{
    Schema::create('lugares_asignados', function (Blueprint $table) {

        $table->id();

        $table->foreignId('lugar_id')
            ->constrained('lugares')
            ->cascadeOnDelete();

        $table->foreignId('participante_id')
            ->constrained('participantes')
            ->cascadeOnDelete();

        $table->timestamps();

        $table->unique('participante_id');
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lugares_asignados');
    }
};
