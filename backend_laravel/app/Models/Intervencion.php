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
        'preparacion_inicia_at',
        'inicio_real_at',
        'fin_real_at',
        'status',
    ];

    protected $casts = [
        'solicita_intervencion' => 'boolean',
        'preparacion_inicia_at' => 'datetime',
        'inicio_real_at' => 'datetime',
        'fin_real_at' => 'datetime',
    ];

    public function participante()
    {
        return $this->belongsTo(Participante::class, 'participante_id');
    }
}
