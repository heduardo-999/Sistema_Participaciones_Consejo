<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Participante;
use App\Models\Historial;
use App\Models\User;
use App\Models\Reunion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ParticipanteController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('participantes.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Participante::with([
                'miembro',
                'invitado',
                'reunion'
            ])
            ->whereHas('reunion', function ($query) {
                $query->where('status', 'activa');
            })
            ->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('participantes.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $reunionActiva = Reunion::where('status', 'activa')
            ->latest('id')
            ->first();

        if (!$reunionActiva) {
            return response()->json([
                'success' => false,
                'message' => 'No existe una reunión activa para agregar participantes.'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        if (empty($datos['miembro_id']) && empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado'
            ], 422);
        }

        if (!empty($datos['miembro_id']) && !empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Solo puedes indicar un miembro o un invitado, no ambos'
            ], 422);
        }

        $datos['reunion_id'] = $reunionActiva->id;
        $datos['fecha'] = now()->toDateString();
        $datos['status'] = 'presente';

        $participante = Participante::create($datos);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear participante',
            'tabla' => 'participantes',
            'dato' => $participante->load(['miembro', 'invitado', 'reunion'])->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante creado correctamente',
            'data' => $participante->load(['miembro', 'invitado', 'reunion'])
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('participantes.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with([
            'miembro',
            'invitado',
            'reunion',
            'intervenciones'
        ])->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $participante
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('participantes.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with('reunion')->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        if (!$participante->reunion || $participante->reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden editar participantes de reuniones activas'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
            'status' => 'required|in:presente,ausente,retirado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        if (empty($datos['miembro_id']) && empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado'
            ], 422);
        }

        if (!empty($datos['miembro_id']) && !empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Solo puedes indicar un miembro o un invitado, no ambos'
            ], 422);
        }

        $antes = $participante->toArray();

        $participante->update($datos);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar participante',
            'tabla' => 'participantes',
            'dato' => [
                'antes' => $antes,
                'despues' => $participante->fresh()->load(['miembro', 'invitado', 'reunion'])->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante actualizado correctamente',
            'data' => $participante->fresh()->load(['miembro', 'invitado', 'reunion'])
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('participantes.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with(['miembro', 'invitado', 'reunion'])->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        $antes = $participante->toArray();

        $participante->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar participante',
            'tabla' => 'participantes',
            'dato' => $antes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante eliminado correctamente'
        ]);
    }
}