<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TemaReunion extends Model
{
    use HasFactory;

    protected $table = 'temas_reunion';

    protected $fillable = [
        'reunion_id',
        'titulo',
        'descripcion',
        'orden',
        'status',
        'completado_at',
    ];

    protected $casts = [
        'completado_at' => 'datetime',
    ];

    public function reunion()
    {
        return $this->belongsTo(Reunion::class, 'reunion_id');
    }
}