<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\TemaReunion;

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
        'inicio_real_at',
        'fin_real_at',
        'intervenciones_pausadas',
        'intervenciones_pausadas_at',
    ];

    protected $casts = [
        'fecha' => 'date',
        'inicio_real_at' => 'datetime',
        'fin_real_at' => 'datetime',
        'intervenciones_pausadas' => 'boolean',
        'intervenciones_pausadas_at' => 'datetime',
    ];

    public function participantes()
    {
        return $this->hasMany(Participante::class, 'reunion_id');
    }

    public function temas()
    {
        return $this->hasMany(TemaReunion::class, 'reunion_id')
            ->orderBy('orden', 'asc')
            ->orderBy('id', 'asc');
    }
}