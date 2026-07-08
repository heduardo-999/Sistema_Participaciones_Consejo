<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Participante;
use App\Models\Reunion;
use App\Models\TokenQr;
use App\Models\User;
use App\Models\Votacion;
use App\Models\Voto;
use App\Services\SocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class VotacionController extends Controller
{
    public function activa()
    {
        $reunion = Reunion::where('status', 'activa')->latest('id')->first();

        if (!$reunion) {
            return response()->json([
                'success' => true,
                'server_now' => now()->toISOString(),
                'data' => [
                    'votacion' => null,
                    'resultados' => $this->resultadosVacios(),
                ],
            ]);
        }

        $votacion = Votacion::where('reunion_id', $reunion->id)
            ->whereIn('status', ['activa', 'finalizada', 'guardada'])
            ->latest('id')
            ->first();

        return response()->json([
            'success' => true,
            'server_now' => now()->toISOString(),
            'data' => [
                'votacion' => $votacion,
                'resultados' => $votacion ? $this->calcularResultados($votacion) : $this->resultadosVacios(),
            ],
        ]);
    }

    public function iniciar(Request $request)
    {
        if (!$this->usuarioPuedeGestionar()) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reunion_id' => 'required|exists:reuniones,id',
            'incluir_invitados' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $reunion = Reunion::findOrFail($request->reunion_id);

        if ($reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'La reunión debe estar activa para iniciar una votación.',
            ], 422);
        }

        $activa = Votacion::where('reunion_id', $reunion->id)
            ->where('status', 'activa')
            ->first();

        if ($activa) {
            return response()->json([
                'success' => false,
                'message' => 'Ya existe una votación activa.',
            ], 422);
        }

        $votacion = Votacion::create([
            'reunion_id' => $reunion->id,
            'nombre' => null,
            'status' => 'activa',
            'incluir_invitados' => (bool) $request->boolean('incluir_invitados'),
            'iniciada_por' => User::mySelf()?->id,
            'iniciada_at' => now(),
            'finalizada_at' => null,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Iniciar votación',
            'tabla' => 'votaciones',
            'dato' => [
                'votacion_id' => $votacion->id,
                'reunion_id' => $reunion->id,
                'incluir_invitados' => $votacion->incluir_invitados,
            ],
        ]);

        $this->emitirActualizacion($votacion, 'iniciar');

        return response()->json([
            'success' => true,
            'message' => 'Votación iniciada correctamente.',
            'server_now' => now()->toISOString(),
            'data' => [
                'votacion' => $votacion->fresh(),
                'resultados' => $this->calcularResultados($votacion),
            ],
        ], 201);
    }

    public function terminar(int $id)
    {
        if (!$this->usuarioPuedeGestionar()) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado',
            ], 403);
        }

        $votacion = Votacion::findOrFail($id);

        if ($votacion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'La votación no está activa.',
            ], 422);
        }

        $votacion->update([
            'status' => 'finalizada',
            'finalizada_at' => now(),
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Terminar votación',
            'tabla' => 'votaciones',
            'dato' => [
                'votacion_id' => $votacion->id,
                'reunion_id' => $votacion->reunion_id,
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);

        $this->emitirActualizacion($votacion, 'terminar');

        return response()->json([
            'success' => true,
            'message' => 'Votación finalizada correctamente.',
            'server_now' => now()->toISOString(),
            'data' => [
                'votacion' => $votacion->fresh(),
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);
    }

    public function guardar(Request $request, int $id)
    {
        if (!$this->usuarioPuedeGestionar()) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors(),
            ], 422);
        }

        $votacion = Votacion::findOrFail($id);

        if (!in_array($votacion->status, ['finalizada', 'guardada'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Primero termina la votación para poder guardarla.',
            ], 422);
        }

        $votacion->update([
            'nombre' => $request->nombre,
            'status' => 'guardada',
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Guardar resultado de votación',
            'tabla' => 'votaciones',
            'dato' => [
                'votacion_id' => $votacion->id,
                'nombre' => $votacion->nombre,
                'reunion_id' => $votacion->reunion_id,
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);

        $this->emitirActualizacion($votacion, 'guardar');

        return response()->json([
            'success' => true,
            'message' => 'Resultado de votación guardado correctamente.',
            'server_now' => now()->toISOString(),
            'data' => [
                'votacion' => $votacion->fresh(),
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);
    }

    public function resultados(int $id)
    {
        $votacion = Votacion::findOrFail($id);

        return response()->json([
            'success' => true,
            'server_now' => now()->toISOString(),
            'data' => [
                'votacion' => $votacion,
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);
    }


    public function porReunion(int $reunionId)
    {
        $reunion = Reunion::findOrFail($reunionId);

        $votaciones = Votacion::where('reunion_id', $reunion->id)
            ->where('status', 'guardada')
            ->latest('id')
            ->get()
            ->map(function (Votacion $votacion) {
                return [
                    'id' => $votacion->id,
                    'reunion_id' => $votacion->reunion_id,
                    'nombre' => $votacion->nombre,
                    'status' => $votacion->status,
                    'incluir_invitados' => (bool) $votacion->incluir_invitados,
                    'iniciada_at' => optional($votacion->iniciada_at)->toISOString(),
                    'finalizada_at' => optional($votacion->finalizada_at)->toISOString(),
                    'created_at' => optional($votacion->created_at)->toISOString(),
                    'updated_at' => optional($votacion->updated_at)->toISOString(),
                    'resultados' => $this->calcularResultados($votacion),
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'server_now' => now()->toISOString(),
            'data' => [
                'reunion' => $reunion,
                'votaciones' => $votaciones,
            ],
        ]);
    }

    public function activaQr(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $tokenQr = $this->buscarTokenActivo($validated['token']);

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado',
            ], 404);
        }

        $validacion = $this->validarTokenQr($tokenQr);

        if ($validacion !== true) {
            return $validacion;
        }

        $participante = $tokenQr->participante;

        $votacion = Votacion::where('reunion_id', $participante->reunion_id)
            ->where('status', 'activa')
            ->latest('id')
            ->first();

        if (!$votacion) {
            return response()->json([
                'success' => true,
                'message' => 'No hay votación activa.',
                'data' => [
                    'votacion' => null,
                    'voto' => null,
                    'puede_votar' => false,
                    'motivo' => '',
                ],
            ]);
        }

        $voto = Voto::where('votacion_id', $votacion->id)
            ->where('participante_id', $participante->id)
            ->first();

        $permiso = $this->puedeVotarParticipante($participante, $votacion);

        return response()->json([
            'success' => true,
            'message' => 'Votación activa encontrada.',
            'data' => [
                'votacion' => $votacion,
                'voto' => $voto,
                'puede_votar' => $permiso['puede'] && !$voto,
                'motivo' => $voto ? 'Ya registraste tu voto.' : $permiso['motivo'],
            ],
        ]);
    }

    public function votarQr(Request $request)
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'voto' => 'required|in:si,no,abstencion',
        ]);

        $tokenQr = $this->buscarTokenActivo($validated['token']);

        if (!$tokenQr) {
            return response()->json([
                'success' => false,
                'message' => 'QR inválido o expirado',
            ], 404);
        }

        $validacion = $this->validarTokenQr($tokenQr);

        if ($validacion !== true) {
            return $validacion;
        }

        $participante = $tokenQr->participante;

        $votacion = Votacion::where('reunion_id', $participante->reunion_id)
            ->where('status', 'activa')
            ->latest('id')
            ->first();

        if (!$votacion) {
            return response()->json([
                'success' => false,
                'message' => 'No hay votación activa.',
            ], 422);
        }

        $permiso = $this->puedeVotarParticipante($participante, $votacion);

        if (!$permiso['puede']) {
            return response()->json([
                'success' => false,
                'message' => $permiso['motivo'],
            ], 403);
        }

        $votoExistente = Voto::where('votacion_id', $votacion->id)
            ->where('participante_id', $participante->id)
            ->first();

        if ($votoExistente) {
            return response()->json([
                'success' => false,
                'message' => 'Ya registraste tu voto.',
                'data' => [
                    'votacion' => $votacion,
                    'voto' => $votoExistente,
                    'puede_votar' => false,
                ],
            ], 422);
        }

        $voto = Voto::create([
            'votacion_id' => $votacion->id,
            'participante_id' => $participante->id,
            'voto' => $validated['voto'],
            'votado_at' => now(),
        ]);

        Historial::create([
            'user_id' => $this->usuarioHistorialQr(),
            'operacion' => 'Registrar voto por QR',
            'tabla' => 'votos',
            'dato' => [
                'votacion_id' => $votacion->id,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion_id,
                'voto' => $validated['voto'],
            ],
        ]);

        $this->emitirActualizacion($votacion, 'votar');

        return response()->json([
            'success' => true,
            'message' => 'Voto registrado correctamente.',
            'data' => [
                'votacion' => $votacion->fresh(),
                'voto' => $voto,
                'puede_votar' => false,
                'resultados' => $this->calcularResultados($votacion),
            ],
        ]);
    }

    private function calcularResultados(Votacion $votacion): array
    {
        $si = Voto::where('votacion_id', $votacion->id)->where('voto', 'si')->count();
        $no = Voto::where('votacion_id', $votacion->id)->where('voto', 'no')->count();
        $abstencion = Voto::where('votacion_id', $votacion->id)->where('voto', 'abstencion')->count();

        return [
            'si' => $si,
            'no' => $no,
            'abstencion' => $abstencion,
            'total' => $si + $no + $abstencion,
        ];
    }

    private function resultadosVacios(): array
    {
        return [
            'si' => 0,
            'no' => 0,
            'abstencion' => 0,
            'total' => 0,
        ];
    }

    private function usuarioPuedeGestionar(): bool
    {
        $user = User::mySelf();

        if (!$user) {
            return false;
        }

        $roles = $user->getRoleNames()
            ->map(fn ($role) => strtolower(trim($role)))
            ->values()
            ->all();

        $tieneRolOperativo = count(array_intersect($roles, [
            'super admin',
            'super-admin',
            'super_admin',
            'admin',
            'administrador',
            'moderador',
        ])) > 0;

        return $tieneRolOperativo;
    }

    private function puedeVotarParticipante(Participante $participante, Votacion $votacion): array
    {
        if ($participante->status === 'retirado') {
            return [
                'puede' => false,
                'motivo' => 'El participante está retirado.',
            ];
        }

        if ($participante->miembro_id) {
            return [
                'puede' => true,
                'motivo' => '',
            ];
        }

        if ($participante->invitado_id && $votacion->incluir_invitados) {
            return [
                'puede' => true,
                'motivo' => '',
            ];
        }

        return [
            'puede' => false,
            'motivo' => 'Esta votación solo permite votos de miembros.',
        ];
    }

    private function buscarTokenActivo(string $token): ?TokenQr
    {
        return TokenQr::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion',
        ])
            ->where('token', $token)
            ->where('status', 'activo')
            ->first();
    }

    private function validarTokenQr(TokenQr $tokenQr)
    {
        if ($tokenQr->expires_at <= now()) {
            $tokenQr->update([
                'status' => 'expirado',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'QR expirado',
            ], 403);
        }

        $participante = $tokenQr->participante;

        if (!$participante) {
            $tokenQr->update([
                'status' => 'expirado',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado',
            ], 404);
        }

        if (!$participante->reunion || $participante->reunion->status !== 'activa') {
            $tokenQr->update([
                'status' => 'expirado',
            ]);

            return response()->json([
                'success' => false,
                'message' => 'La reunión ya no está activa',
            ], 403);
        }

        return true;
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

    private function emitirActualizacion(Votacion $votacion, string $accion): void
    {
        SocketService::emit('votacion:updated', [
            'accion' => $accion,
            'votacion_id' => $votacion->id,
            'reunion_id' => $votacion->reunion_id,
            'status' => $votacion->status,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'votacion_' . $accion,
            'votacion_id' => $votacion->id,
            'reunion_id' => $votacion->reunion_id,
        ]);

        SocketService::emit('qr:updated', [
            'accion' => 'votacion_' . $accion,
            'votacion_id' => $votacion->id,
            'reunion_id' => $votacion->reunion_id,
        ]);
    }
}
