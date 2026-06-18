<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Intervencion;
use App\Models\Participante;
use App\Models\TokenQr;
use App\Models\User;
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

        TokenQr::where('expires_at', '<=', now())
            ->where('status', 'activo')
            ->update(['status' => 'expirado']);

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

        $tokenQr = TokenQr::where('participante_id', $participante->id)
            ->where('status', 'activo')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if ($tokenQr) {
            return response()->json([
                'success' => true,
                'message' => 'QR vigente encontrado',
                'data' => $this->respuestaQr($tokenQr, $participante),
            ]);
        }

        TokenQr::where('participante_id', $participante->id)
            ->where('status', 'activo')
            ->update(['status' => 'expirado']);

        $tokenQr = TokenQr::create([
            'participante_id' => $participante->id,
            'token' => Str::random(80),
            'expires_at' => now()->addHours(12),
            'status' => 'activo',
        ]);

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
                'expires_at' => $tokenQr->expires_at,
                'url' => $this->urlQr($tokenQr->token),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'QR generado correctamente',
            'data' => $this->respuestaQr($tokenQr, $participante),
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
            'user_id' => $this->usuarioHistorialQr(),
            'operacion' => 'Solicitud de intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'reunion' => $participante->reunion->sesion,
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
            'user_id' => $this->usuarioHistorialQr(),
            'operacion' => 'Cancelar intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'reunion' => $participante->reunion->sesion,
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
            'status' => 'fin intervencion',
        ]);

        Historial::create([
            'user_id' => $this->usuarioHistorialQr(),
            'operacion' => 'Finalizar intervención por QR',
            'tabla' => 'intervenciones',
            'dato' => [
                'token_qr_id' => $tokenQr->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion->id,
                'reunion' => $participante->reunion->sesion,
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
        if ($tokenQr->expires_at <= now()) {
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

        $estadoLed = 'no_participa';

        if ($intervencion?->status === 'aun no intervino') {
            $estadoLed = 'solicita_participacion';
        }

        if ($intervencion?->status === 'interviniendo') {
            $estadoLed = 'participa';
        }

        return [
            'token_qr_id' => $tokenQr->id,
            'token' => $tokenQr->token,
            'url' => $url ?? $this->urlQr($tokenQr->token),
            'expires_at' => $tokenQr->expires_at,
            'participante' => [
                'id' => $participante->id,
                'nombre' => $this->nombreParticipante($participante),
                'tipo' => $participante->miembro_id ? 'miembro' : 'invitado',
                'status' => $participante->status,
                'rfid' => $participante->miembro?->rfid,
            ],
            'reunion' => [
                'id' => $participante->reunion?->id,
                'sesion' => $participante->reunion?->sesion,
                'fecha' => $participante->reunion?->fecha,
                'status' => $participante->reunion?->status,
                'hora_inicio' => $participante->reunion?->hora_inicio,
                'hora_fin' => $participante->reunion?->hora_fin,
            ],
            'intervencion' => [
                'id' => $intervencion?->id,
                'status' => $intervencion?->status,
                'solicita_intervencion' => (bool) $intervencion?->solicita_intervencion,
                'hora_inicio' => $intervencion?->hora_inicio,
                'hora_fin' => $intervencion?->hora_fin,
                'estado_led' => $estadoLed,
            ],
        ];
    }

    private function urlQr(string $token): string
    {
        return config('app.frontend_url', env('FRONTEND_URL', 'http://192.168.0.26:4200'))
            . '/qr/esp32/' . $token;
    }

    private function usuarioHistorialQr(): int
    {
        $authUser = User::mySelf();

        if ($authUser) {
            return $authUser->id;
        }

        $superAdmin = User::role('super admin')->first();

        if ($superAdmin) {
            return $superAdmin->id;
        }

        return User::query()->value('id');
    }

    private function nombreParticipante(Participante $participante): string
    {
        return $participante->miembro?->nombre
            ?? $participante->invitado?->nombre
            ?? 'Participante sin nombre';
    }
}