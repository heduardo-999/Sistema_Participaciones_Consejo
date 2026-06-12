<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\TokenQr;
use App\Models\Participante;
use App\Models\Intervencion;
use App\Models\Historial;
use App\Models\User;

use Illuminate\Support\Str;
use Carbon\Carbon;

class QrAccessController extends Controller
{
    public function generar(Request $request)
    {
        $request->validate([
            'participante_id' => 'required|exists:participantes,id'
        ]);

        $participante = Participante::findOrFail(
            $request->participante_id
        );

        $token = 'QR_' . Str::random(40);

        $registro = TokenQr::create([
            'participante_id' => $participante->id,
            'token' => $token,
            'expires_at' => now()->addDay(),
            'status' => 'activo'
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Generar token QR',
            'tabla' => 'token_qrs',
            'dato' => $registro->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $token,
                'expires_at' => $registro->expires_at
            ]
        ]);
    }

    public function validar(Request $request)
    {
        $request->validate([
            'token' => 'required'
        ]);

        $tokenQr = TokenQr::where(
            'token',
            $request->token
        )->first();

        if (!$tokenQr) {

            return response()->json([
                'success' => false,
                'message' => 'Token inválido'
            ], 404);
        }

        if (
            $tokenQr->status === 'expirado'
        ) {

            return response()->json([
                'success' => false,
                'message' => 'Token expirado'
            ], 403);
        }

        if (
            Carbon::now()->gt(
                $tokenQr->expires_at
            )
        ) {

            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Token expirado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Token válido',
            'participante' => $tokenQr->participante
        ]);
    }

    public function interaccion(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'accion' => 'required'
        ]);

        $tokenQr = TokenQr::where(
            'token',
            $request->token
        )->first();

        if (!$tokenQr) {

            return response()->json([
                'success' => false,
                'message' => 'Token inválido'
            ], 404);
        }

        if (
            $tokenQr->status === 'expirado'
        ) {

            return response()->json([
                'success' => false,
                'message' => 'Token expirado'
            ], 403);
        }

        if (
            Carbon::now()->gt(
                $tokenQr->expires_at
            )
        ) {

            $tokenQr->update([
                'status' => 'expirado'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Token expirado'
            ], 403);
        }

        $participante = $tokenQr->participante;

        if (
            $request->accion === 'solicitar_intervencion'
        ) {

            $intervencion = Intervencion::create([
                'participante_id' => $participante->id,
                'solicita_intervencion' => true,
                'status' => 'aun no intervino'
            ]);

            Historial::create([
                'user_id' => $participante->id,
                'operacion' => 'Solicitud de intervención por QR',
                'tabla' => 'intervenciones',
                'dato' => $intervencion->toArray(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Intervención solicitada correctamente'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Acción no válida'
        ], 422);
    }
}