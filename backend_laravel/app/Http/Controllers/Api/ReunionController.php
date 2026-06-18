<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Reunion;
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
            'data' => Reunion::orderBy('id', 'desc')->get()
        ]);
    }

    public function activa()
    {
        $reunion = Reunion::where('status', 'activa')
            ->latest('id')
            ->first();

        return response()->json([
            'success' => true,
            'data' => $reunion
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
            'sesion' => 'required|string|max:255',
            'fecha' => 'required|date',
            'status' => 'required|in:activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable',
            'hora_fin' => 'nullable',
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

        $reunion = Reunion::with([
            'participantes.miembro',
            'participantes.invitado',
            'participantes.intervenciones'
        ])->find($id);

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
            'sesion' => 'required|string|max:255',
            'fecha' => 'required|date',
            'status' => 'required|in:activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable',
            'hora_fin' => 'nullable',
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
                'despues' => $reunion->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión actualizada correctamente',
            'data' => $reunion->fresh()
        ]);
    }

    public function iniciar(string $id)
    {
        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        $reunion->update([
            'status' => 'activa',
            'hora_inicio' => now()->format('H:i:s'),
            'hora_fin' => null,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Iniciar reunión',
            'tabla' => 'reuniones',
            'dato' => $reunion->fresh()->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión iniciada correctamente',
            'data' => $reunion->fresh()
        ]);
    }

    public function terminar(string $id)
    {
        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        $reunion->update([
            'status' => 'terminada',
            'hora_fin' => now()->format('H:i:s'),
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Terminar reunión',
            'tabla' => 'reuniones',
            'dato' => $reunion->fresh()->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión terminada correctamente',
            'data' => $reunion->fresh()
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