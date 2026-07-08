<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Votacion extends Model
{
    use HasFactory;

    protected $table = 'votaciones';

    protected $fillable = [
        'reunion_id',
        'nombre',
        'status',
        'incluir_invitados',
        'iniciada_por',
        'iniciada_at',
        'finalizada_at',
    ];

    protected $casts = [
        'incluir_invitados' => 'boolean',
        'iniciada_at' => 'datetime',
        'finalizada_at' => 'datetime',
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class);
    }

    public function votos()
    {
        return $this->hasMany(Voto::class);
    }

    public function iniciador()
    {
        return $this->belongsTo(User::class, 'iniciada_por');
    }
}
