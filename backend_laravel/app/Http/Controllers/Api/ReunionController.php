<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reunion;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReunionController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('reuniones.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Reunion::all()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('reuniones.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'sesion' => 'required|string|max:100',
            'fecha' => 'required|date',
            'status' => 'required|in:activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $reunion = Reunion::create($validator->validated());

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear reunión',
            'tabla' => 'reuniones',
            'dato' => $reunion->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión creada correctamente',
            'data' => $reunion
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('reuniones.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $reunion = Reunion::with('participantes')->find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $reunion
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('reuniones.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'sesion' => 'required|string|max:100',
            'fecha' => 'required|date',
            'status' => 'required|in:activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $antes = $reunion->toArray();

        $reunion->update($validator->validated());

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar reunión',
            'tabla' => 'reuniones',
            'dato' => [
                'antes' => $antes,
                'despues' => $reunion->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión actualizada correctamente',
            'data' => $reunion
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('reuniones.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        $antes = $reunion->toArray();

        $reunion->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar reunión',
            'tabla' => 'reuniones',
            'dato' => $antes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión eliminada correctamente'
        ]);
    }
}