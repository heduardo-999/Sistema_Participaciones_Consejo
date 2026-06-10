<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lugar extends Model
{
    protected $table = 'lugares';

    protected $fillable = [
        'mesa_id',
        'esp_id',
        'status',
        'baja',
    ];

    public function asignaciones()
    {
        return $this->hasMany(LugarAsignado::class);
    }
}