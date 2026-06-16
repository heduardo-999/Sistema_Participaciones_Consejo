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
            'data' => $this->respuestaQr($tokenQr->fresh(), $participante, $url),
        ], 201);
    }

    public function validar(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $tokenQr = $this->buscarTokenActivo($validated['token']);

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado'
            ], 404);
        }

        $validacion = $this->validarTokenQr($tokenQr);

        if ($validacion !== true) {
            return $validacion;
        }

        return response()->json([
            'success' => true,
            'message' => 'QR válido',
            'data' => $this->respuestaQr($tokenQr, $tokenQr->participante),
        ]);
    }

    public function interaccion(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'accion' => 'required|string|in:solicitar_intervencion,cancelar_intervencion,finalizar_intervencion',
        ]);

        $tokenQr = $this->buscarTokenActivo($validated['token']);

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado'
            ], 404);
        }

        $validacion = $this->validarTokenQr($tokenQr);

        if ($validacion !== true) {
            return $validacion;
        }

        $participante = $tokenQr->participante;

        $intervencion = Intervencion::where('participante_id', $participante->id)
            ->where('solicita_intervencion', true)
            ->whereIn('status', ['aun no intervino', 'interviniendo'])
            ->latest()
            ->first();

        if ($validated['accion'] === 'solicitar_intervencion') {
            if ($intervencion && $intervencion->status === 'interviniendo') {
                return $this->finalizarIntervencion($tokenQr, $intervencion);
            }

            if ($intervencion && $intervencion->status === 'aun no intervino') {
                return $this->cancelarIntervencion($tokenQr, $intervencion);
            }

            return $this->solicitarIntervencion($tokenQr);
        }

        if ($validated['accion'] === 'cancelar_intervencion') {
            if (!$intervencion) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay solicitud de intervención activa para cancelar'
                ], 422);
            }

            if ($intervencion->status === 'interviniendo') {
                return response()->json([
                    'success' => false,
                    'message' => 'La intervención ya está en curso. Debe finalizarse.'
                ], 422);
            }

            return $this->cancelarIntervencion($tokenQr, $intervencion);
        }

        if ($validated['accion'] === 'finalizar_intervencion') {
            if (!$intervencion || $intervencion->status !== 'interviniendo') {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay intervención en curso para finalizar'
                ], 422);
            }

            return $this->finalizarIntervencion($tokenQr, $intervencion);
        }

        return response()->json([
            'success' => false,
            'message' => 'Acción no válida'
        ], 422);
    }

    private function solicitarIntervencion(TokenQr $tokenQr)
    {
        $participante = $tokenQr->participante;

        $intervencion = Intervencion::create([
            'participante_id' => $participante->id,
            'solicita_intervencion' => true,
            'hora_inicio' => null,
            'hora_fin' => null,
            'status' => 'aun no intervino',
        ]);

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
            'accion' => 'solicitada',
            'data' => $this->respuestaQr($tokenQr->fresh(), $participante),
        ]);
    }

    private function cancelarIntervencion(TokenQr $tokenQr, Intervencion $intervencion)
    {
        $participante = $tokenQr->participante;
        $antes = $intervencion->toArray();

        $intervencion->delete();

        Historial::create([
            'user_id' => User::mySelf()?->id,
            'operacion' => 'Cancelar intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'intervencion_cancelada' => $antes,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Solicitud de intervención cancelada correctamente',
            'accion' => 'cancelada',
            'data' => $this->respuestaQr($tokenQr->fresh(), $participante),
        ]);
    }

    private function finalizarIntervencion(TokenQr $tokenQr, Intervencion $intervencion)
    {
        $participante = $tokenQr->participante;
        $antes = $intervencion->toArray();

        $intervencion->update([
            'solicita_intervencion' => false,
            'hora_fin' => now()->format('H:i:s'),
        ]);

        Historial::create([
            'user_id' => User::mySelf()?->id,
            'operacion' => 'Finalizar intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'intervencion_antes' => $antes,
                'intervencion_despues' => $intervencion->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervención finalizada correctamente',
            'accion' => 'finalizada',
            'data' => $this->respuestaQr($tokenQr->fresh(), $participante),
        ]);
    }

    private function buscarTokenActivo(string $token): ?TokenQr
    {
        return TokenQr::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])
            ->where('token', $token)
            ->where('status', 'activo')
            ->first();
    }

    private function validarTokenQr(TokenQr $tokenQr)
    {
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

        return true;
    }

    private function respuestaQr(TokenQr $tokenQr, Participante $participante, ?string $url = null): array
    {
        $participante->loadMissing([
            'miembro',
            'invitado',
            'reunion'
        ]);

        $intervencion = Intervencion::where('participante_id', $participante->id)
            ->where('solicita_intervencion', true)
            ->whereIn('status', ['aun no intervino', 'interviniendo'])
            ->latest()
            ->first();

        $estadoIntervencion = 'no_participa';

        if ($intervencion && $intervencion->status === 'aun no intervino') {
            $estadoIntervencion = 'solicita_participacion';
        }

        if ($intervencion && $intervencion->status === 'interviniendo') {
            $estadoIntervencion = 'participa';
        }

        return [
            'token_qr_id' => $tokenQr->id,
            'token' => $tokenQr->token,
            'url' => $url,
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
            'intervencion' => [
                'id' => $intervencion?->id,
                'status' => $intervencion?->status,
                'solicita_intervencion' => $intervencion?->solicita_intervencion ?? false,
                'hora_inicio' => $intervencion?->hora_inicio,
                'hora_fin' => $intervencion?->hora_fin,
                'estado_led' => $estadoIntervencion,
            ],
        ];
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