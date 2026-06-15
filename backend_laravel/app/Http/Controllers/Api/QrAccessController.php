<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Intervencion;
use App\Models\Participante;
use App\Models\TokenQr;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class QrAccessController extends Controller
{
    public function generar(Request $request)
    {
        if (!User::mySelf()->can('participantes.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validated = $request->validate([
            'participante_id' => 'required|exists:participantes,id',
        ]);

        $participante = Participante::with([
            'miembro',
            'invitado',
            'reunion'
        ])->findOrFail($validated['participante_id']);

        if (!$participante->reunion) {
            return response()->json([
                'success' => false,
                'message' => 'El participante no tiene reunión asignada'
            ], 422);
        }

        if ($participante->reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede generar QR porque la reunión no está activa'
            ], 422);
        }

        if ($participante->status === 'retirado') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede generar QR para un participante retirado'
            ], 422);
        }

        TokenQr::where('participante_id', $participante->id)
            ->where('status', 'activo')
            ->update([
                'status' => 'expirado'
            ]);

        $token = Str::random(80);

        $expiresAt = $this->calcularExpiracion($participante);

        $tokenQr = TokenQr::create([
            'participante_id' => $participante->id,
            'token' => $token,
            'expires_at' => $expiresAt,
            'status' => 'activo',
        ]);

        $url = config('app.frontend_url', 'http://localhost:4200')
            . '/qr/esp32/' . $token;

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Generar QR temporal',
            'tabla' => 'token_qrs',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'reunion' => $participante->reunion->sesion,
                'expires_at' => $expiresAt->toDateTimeString(),
                'url' => $url,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'QR generado correctamente',
            'data' => [
                'token_qr_id' => $tokenQr->id,
                'token' => $token,
                'url' => $url,
                'expires_at' => $expiresAt->toDateTimeString(),
                'participante' => [
                    'id' => $participante->id,
                    'nombre' => $this->nombreParticipante($participante),
                    'tipo' => $participante->miembro ? 'miembro' : 'invitado',
                    'status' => $participante->status,
                ],
                'reunion' => [
                    'id' => $participante->reunion->id,
                    'sesion' => $participante->reunion->sesion,
                    'fecha' => $participante->reunion->fecha,
                    'status' => $participante->reunion->status,
                    'hora_inicio' => $participante->reunion->hora_inicio,
                    'hora_fin' => $participante->reunion->hora_fin,
                ],
            ],
        ], 201);
    }

    public function validar(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $tokenQr = TokenQr::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])
            ->where('token', $validated['token'])
            ->where('status', 'activo')
            ->first();

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado'
            ], 404);
        }

        if (Carbon::parse($tokenQr->expires_at)->isPast()) {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'QR expirado'
            ], 403);
        }

        $participante = $tokenQr->participante;

        if (!$participante) {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        if (!$participante->reunion || $participante->reunion->status !== 'activa') {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'La reunión ya no está activa'
            ], 403);
        }

        if ($participante->status === 'retirado') {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'El participante está retirado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'QR válido',
            'data' => [
                'token_qr_id' => $tokenQr->id,
                'expires_at' => $tokenQr->expires_at,
                'participante' => [
                    'id' => $participante->id,
                    'nombre' => $this->nombreParticipante($participante),
                    'tipo' => $participante->miembro ? 'miembro' : 'invitado',
                    'status' => $participante->status,
                    'rfid' => $participante->miembro?->rfid,
                ],
                'reunion' => [
                    'id' => $participante->reunion->id,
                    'sesion' => $participante->reunion->sesion,
                    'fecha' => $participante->reunion->fecha,
                    'status' => $participante->reunion->status,
                    'hora_inicio' => $participante->reunion->hora_inicio,
                    'hora_fin' => $participante->reunion->hora_fin,
                ],
            ],
        ]);
    }

    public function interaccion(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'accion' => 'required|string|in:solicitar_intervencion',
        ]);

        $tokenQr = TokenQr::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])
            ->where('token', $validated['token'])
            ->where('status', 'activo')
            ->first();

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado'
            ], 404);
        }

        if (Carbon::parse($tokenQr->expires_at)->isPast()) {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'QR expirado'
            ], 403);
        }

        $participante = $tokenQr->participante;

        if (!$participante || !$participante->reunion || $participante->reunion->status !== 'activa') {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'La reunión ya no está activa'
            ], 403);
        }

        if ($participante->status === 'retirado') {
            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'El participante está retirado'
            ], 403);
        }

        $intervencion = Intervencion::firstOrCreate(
            [
                'participante_id' => $participante->id,
                'status' => 'aun no intervino',
            ],
            [
                'solicita_intervencion' => true,
                'hora_inicio' => null,
                'hora_fin' => null,
            ]
        );

        Historial::create([
            'user_id' => User::mySelf()?->id,
            'operacion' => 'Solicitud de intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'intervencion_id' => $intervencion->id,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervención solicitada correctamente',
            'data' => $intervencion->load([
                'participante.miembro',
                'participante.invitado',
                'participante.reunion',
            ]),
        ]);
    }

    private function calcularExpiracion(Participante $participante): Carbon
    {
        $fecha = $participante->reunion->fecha;
        $horaFin = $participante->reunion->hora_fin;

        if ($fecha && $horaFin) {
            return Carbon::parse($fecha . ' ' . $horaFin);
        }

        if ($fecha) {
            return Carbon::parse($fecha . ' 23:59:59');
        }

        return now()->addHours(2);
    }

    private function nombreParticipante(Participante $participante): string
    {
        return $participante->miembro?->nombre
            ?? $participante->invitado?->nombre
            ?? 'Participante sin nombre';
    }
}