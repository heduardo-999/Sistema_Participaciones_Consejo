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
    Schema::create('lugares', function (Blueprint $table) {
        $table->id();

        $table->string('mesa_id')->unique();
        $table->string('esp_id')->unique();

        $table->enum('status', [
            'funcional',
            'mantenimiento',
            'dañada',
            'denegado'      
        ])->default('funcional');

        $table->tinyInteger('baja')->default(0);

        $table->timestamps();
    });
}

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lugares');
    }
};
