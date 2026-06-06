<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invitado;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InvitadoController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('invitados.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Invitado::all()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('invitados.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'fecha_participacion' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $invitado = Invitado::create([
            'nombre' => $request->nombre,
            'fecha_participacion' => $request->fecha_participacion,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear invitado',
            'tabla' => 'invitados',
            'dato' => $invitado->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Invitado creado correctamente',
            'data' => $invitado
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('invitados.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $invitado = Invitado::find($id);

        if (!$invitado) {
            return response()->json([
                'success' => false,
                'message' => 'Invitado no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $invitado
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('invitados.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $invitado = Invitado::find($id);

        if (!$invitado) {
            return response()->json([
                'success' => false,
                'message' => 'Invitado no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'fecha_participacion' => 'required|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $antes = $invitado->toArray();

        $invitado->update([
            'nombre' => $request->nombre,
            'fecha_participacion' => $request->fecha_participacion,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar invitado',
            'tabla' => 'invitados',
            'dato' => [
                'antes' => $antes,
                'despues' => $invitado->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Invitado actualizado correctamente',
            'data' => $invitado
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('invitados.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $invitado = Invitado::find($id);

        if (!$invitado) {
            return response()->json([
                'success' => false,
                'message' => 'Invitado no encontrado'
            ], 404);
        }

        $antes = $invitado->toArray();

        $invitado->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar invitado',
            'tabla' => 'invitados',
            'dato' => $antes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Invitado eliminado correctamente'
        ]);
    }
}