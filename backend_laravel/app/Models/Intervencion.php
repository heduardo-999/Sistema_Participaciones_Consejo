<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Intervencion extends Model
{
    use HasFactory;

    protected $table = 'intervenciones';

    protected $fillable = [
        'participante_id',
        'solicita_intervencion',
        'hora_inicio',
        'hora_fin',
        'status',
    ];

    public function participante()
    {
        return $this->belongsTo(Participante::class, 'participante_id');
    }
}