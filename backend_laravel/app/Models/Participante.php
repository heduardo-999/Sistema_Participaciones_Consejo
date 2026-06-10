<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Participante extends Model
{
    use HasFactory;

    protected $table = 'participantes';

    protected $fillable = [
        'miembro_id',
        'invitado_id',
        'reunion_id',
        'fecha',
        'status',
    ];

    public function miembro()
    {
        return $this->belongsTo(Miembro::class, 'miembro_id');
    }

    public function invitado()
    {
        return $this->belongsTo(Invitado::class, 'invitado_id');
    }

    public function reunion()
    {
        return $this->belongsTo(Reunion::class, 'reunion_id');
    }

    public function intervenciones()
    {
        return $this->hasMany(Intervencion::class, 'participante_id');
    }

    public function lugarAsignado()
    {
        return $this->hasOne(LugarAsignado::class);
    }
}