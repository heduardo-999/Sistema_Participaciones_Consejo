<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Miembro extends Model
{
    use HasFactory;

    protected $table = 'miembros';

    protected $fillable = [
        'nombre',
        'fecha',
        'baja',
        'rfid',
    ];

    public function participantes()
    {
        return $this->hasMany(Participante::class, 'miembro_id');
    }
}