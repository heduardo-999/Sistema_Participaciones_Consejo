<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lugar;
use App\Models\LugarAsignado;
use App\Models\Participante;
use App\Models\User;
use App\Models\Historial;
use App\Services\SocketService;
use Illuminate\Http\Request;

class LugarAsignadoController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('lugares_asignados.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => LugarAsignado::with([
                'lugar',
                'participante.miembro',
                'participante.invitado',
                'participante.reunion'
            ])->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('lugares_asignados.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validated = $request->validate([
            'lugar_id' => 'required|exists:lugares,id',
            'participante_id' => 'required|exists:participantes,id'
        ]);

        $lugar = Lugar::findOrFail($validated['lugar_id']);

        if ($lugar->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'El lugar está dado de baja'
            ], 403);
        }

        if ($lugar->status === 'denegado') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede asignar este lugar porque el acceso fue denegado por un administrador.'
            ], 403);
        }

        $warning = null;

        if ($lugar->status === 'mantenimiento') {
            $warning = 'ESP32 en mantenimiento. Se recomienda utilizar acceso mediante QR.';
        }

        if ($lugar->status === 'dañada') {
            $warning = 'ESP32 dañado. Debe utilizarse acceso mediante QR.';
        }

        if (LugarAsignado::where('lugar_id', $validated['lugar_id'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar ya ocupado'
            ], 422);
        }

        if (LugarAsignado::where('participante_id', $validated['participante_id'])->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Participante ya tiene lugar'
            ], 422);
        }

        $participante = Participante::with([
            'miembro',
            'invitado',
            'reunion'
        ])->findOrFail($validated['participante_id']);

        $validacionParticipante = $this->validarParticipanteAsignable($participante);

        if ($validacionParticipante !== true) {
            return $validacionParticipante;
        }

        $asignacion = LugarAsignado::create([
            'lugar_id' => $validated['lugar_id'],
            'participante_id' => $validated['participante_id'],
        ]);

        if ($participante->status !== 'presente') {
            $participante->update([
                'status' => 'presente'
            ]);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Asignar lugar',
            'tabla' => 'lugares_asignados',
            'dato' => [
                'asignacion' => $asignacion->toArray(),
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion?->id,
                'reunion' => $participante->reunion?->sesion,
                'lugar_id' => $lugar->id,
                'esp_id' => $lugar->esp_id,
                'warning' => $warning,
            ],
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'asignar',
            'lugar_id' => $lugar->id,
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'presente_por_asignacion',
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'asignar_lugar',
            'lugar_id' => $lugar->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lugar asignado correctamente',
            'warning' => $warning,
            'data' => $asignacion->load([
                'lugar',
                'participante.miembro',
                'participante.invitado',
                'participante.reunion'
            ])
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::with([
            'lugar',
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])->find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $asignacion
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        $validated = $request->validate([
            'lugar_id' => 'required|exists:lugares,id',
            'participante_id' => 'required|exists:participantes,id'
        ]);

        $lugar = Lugar::findOrFail($validated['lugar_id']);

        if ($lugar->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'El lugar está dado de baja'
            ], 403);
        }

        if ($lugar->status === 'denegado') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede asignar este lugar porque el acceso fue denegado por un administrador.'
            ], 403);
        }

        if (
            LugarAsignado::where('lugar_id', $validated['lugar_id'])
                ->where('id', '!=', $asignacion->id)
                ->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar ya ocupado'
            ], 422);
        }

        if (
            LugarAsignado::where('participante_id', $validated['participante_id'])
                ->where('id', '!=', $asignacion->id)
                ->exists()
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Participante ya tiene lugar'
            ], 422);
        }

        $participante = Participante::with([
            'miembro',
            'invitado',
            'reunion'
        ])->findOrFail($validated['participante_id']);

        $validacionParticipante = $this->validarParticipanteAsignable($participante);

        if ($validacionParticipante !== true) {
            return $validacionParticipante;
        }

        $antes = $asignacion->load([
            'lugar',
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])->toArray();

        $asignacion->update([
            'lugar_id' => $validated['lugar_id'],
            'participante_id' => $validated['participante_id'],
        ]);

        if ($participante->status !== 'presente') {
            $participante->update([
                'status' => 'presente'
            ]);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar lugar asignado',
            'tabla' => 'lugares_asignados',
            'dato' => [
                'antes' => $antes,
                'despues' => $asignacion->load([
                    'lugar',
                    'participante.miembro',
                    'participante.invitado',
                    'participante.reunion'
                ])->toArray(),
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion?->id,
                'reunion' => $participante->reunion?->sesion,
                'lugar_id' => $lugar->id,
                'esp_id' => $lugar->esp_id,
            ],
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'actualizar_asignacion',
            'lugar_id' => $lugar->id,
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'actualizar_asignacion',
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Asignación actualizada correctamente',
            'data' => $asignacion->load([
                'lugar',
                'participante.miembro',
                'participante.invitado',
                'participante.reunion'
            ])
        ]);
    }

    public function marcarAusente(string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::with('participante')->find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        $participante = $asignacion->participante;
        $antes = $participante->toArray();

        $participante->update([
            'status' => 'ausente'
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Marcar ausente',
            'tabla' => 'participantes',
            'dato' => [
                'antes' => $antes,
                'despues' => $participante->fresh()->toArray(),
                'lugar_asignado_id' => $asignacion->id,
            ],
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'marcar_ausente',
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'marcar_ausente',
            'lugar_asignado_id' => $asignacion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante marcado como ausente',
            'data' => $asignacion->load([
                'lugar',
                'participante.miembro',
                'participante.invitado',
                'participante.reunion'
            ])
        ]);
    }

    public function reiniciarTemporizador(string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Reiniciar temporizador',
            'tabla' => 'lugares_asignados',
            'dato' => [
                'lugar_asignado_id' => $asignacion->id
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Temporizador reiniciado'
        ]);
    }

    public function liberar(string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion',
            'lugar'
        ])->find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        $participante = $asignacion->participante;

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'La asignación no tiene participante vinculado'
            ], 422);
        }

        $antesParticipante = $participante->toArray();
        $antesAsignacion = $asignacion->toArray();

        $participante->update([
            'status' => 'ausente'
        ]);

        $participanteDespues = $participante->fresh()->toArray();

        $asignacion->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Liberar lugar',
            'tabla' => 'lugares_asignados',
            'dato' => [
                'asignacion' => $antesAsignacion,
                'participante_id' => $participante->id,
                'participante' => $this->nombreParticipante($participante),
                'reunion_id' => $participante->reunion?->id,
                'reunion' => $participante->reunion?->sesion,
                'participante_antes' => $antesParticipante,
                'participante_despues' => $participanteDespues,
                'nota' => 'El participante queda ausente al retirar/liberar RFID del lugar.',
            ],
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'liberar',
            'lugar_asignado_id' => $asignacion->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'ausente_por_liberacion',
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lugar liberado correctamente. El participante quedó como ausente.',
            'data' => [
                'participante' => $participanteDespues,
                'asignacion_eliminada' => $antesAsignacion,
            ],
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('lugares_asignados.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $asignacion = LugarAsignado::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion',
            'lugar'
        ])->find($id);

        if (!$asignacion) {
            return response()->json([
                'success' => false,
                'message' => 'Asignación no encontrada'
            ], 404);
        }

        $antes = $asignacion->toArray();
        $participante = $asignacion->participante;

        $asignacion->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar lugar asignado',
            'tabla' => 'lugares_asignados',
            'dato' => [
                'asignacion' => $antes,
                'participante_id' => $participante?->id,
                'participante' => $participante ? $this->nombreParticipante($participante) : null,
                'reunion_id' => $participante?->reunion?->id,
                'reunion' => $participante?->reunion?->sesion,
            ],
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'eliminar_asignacion',
            'lugar_asignado_id' => $id,
            'reunion_id' => $participante?->reunion?->id,
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'eliminar_asignacion',
            'participante_id' => $participante?->id,
            'reunion_id' => $participante?->reunion?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Asignación eliminada correctamente'
        ]);
    }

    private function validarParticipanteAsignable(Participante $participante)
    {
        if ($participante->status === 'retirado') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede asignar lugar a un participante retirado'
            ], 422);
        }

        if (!$participante->reunion) {
            return response()->json([
                'success' => false,
                'message' => 'El participante no tiene una reunión asignada'
            ], 422);
        }

        if ($participante->reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden asignar lugares a participantes de una reunión activa'
            ], 422);
        }

        return true;
    }

    private function nombreParticipante(Participante $participante): string
    {
        return $participante->miembro?->nombre
            ?? $participante->invitado?->nombre
            ?? 'Participante sin nombre';
    }
}