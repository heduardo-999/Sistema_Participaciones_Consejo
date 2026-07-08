<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Voto extends Model
{
    use HasFactory;

    protected $table = 'votos';

    protected $fillable = [
        'votacion_id',
        'participante_id',
        'voto',
        'votado_at',
    ];

    protected $casts = [
        'votado_at' => 'datetime',
    ];

    public function votacion()
    {
        return $this->belongsTo(Votacion::class);
    }

    public function participante()
    {
        return $this->belongsTo(Participante::class);
    }
}
