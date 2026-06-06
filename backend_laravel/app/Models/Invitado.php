<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invitado extends Model
{
    use HasFactory;

    protected $table = 'invitados';

    protected $fillable = [
        'nombre',
        'fecha_participacion',
    ];

    public function participantes()
    {
        return $this->hasMany(Participante::class, 'invitado_id');
    }
}