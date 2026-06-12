<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TokenQr extends Model
{
    protected $table = 'token_qrs';

    protected $fillable = [
        'participante_id',
        'token',
        'expires_at',
        'status',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function participante()
    {
        return $this->belongsTo(Participante::class);
    }
}