<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reunion extends Model
{
    use HasFactory;

    protected $table = 'reuniones';

    protected $fillable = [
        'sesion',
        'fecha',
        'status',
        'hora_inicio',
        'hora_fin',
    ];

    public function participantes()
    {
        return $this->hasMany(Participante::class, 'reunion_id');
    }
}