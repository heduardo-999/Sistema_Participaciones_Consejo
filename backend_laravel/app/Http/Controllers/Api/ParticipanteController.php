<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Participante;
use App\Models\Historial;
use App\Models\User;
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
            ])->get()
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

        $validator = Validator::make($request->all(), [
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
            'reunion_id' => 'required|exists:reuniones,id',
            'fecha' => 'required|date',
            'status' => 'required|in:presente,ausente,retirado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        if (
            empty($datos['miembro_id']) &&
            empty($datos['invitado_id'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado'
            ], 422);
        }

        $participante = Participante::create($datos);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear participante',
            'tabla' => 'participantes',
            'dato' => $participante->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante creado correctamente',
            'data' => $participante
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

        $participante = Participante::find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
            'reunion_id' => 'required|exists:reuniones,id',
            'fecha' => 'required|date',
            'status' => 'required|in:presente,retirado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        if (
            empty($datos['miembro_id']) &&
            empty($datos['invitado_id'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado'
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
                'despues' => $participante->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante actualizado correctamente',
            'data' => $participante
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

        $participante = Participante::find($id);

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