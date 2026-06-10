<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LugarAsignado extends Model
{
    protected $table = 'lugares_asignados';

    protected $fillable = [
        'lugar_id',
        'participante_id',
    ];

    public function lugar()
    {
        return $this->belongsTo(Lugar::class);
    }

    public function participante()
    {
        return $this->belongsTo(Participante::class);
    }
}