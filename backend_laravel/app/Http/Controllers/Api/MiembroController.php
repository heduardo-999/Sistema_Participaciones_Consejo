<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Miembro;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MiembroController extends Controller
{
    public function index(Request $request)
    {
        if (!User::mySelf()->can('miembros.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $query = Miembro::query();

        if ($request->filled('baja')) {
            $query->where('baja', $request->baja);
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('id')->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('miembros.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'fecha' => 'required|date',
            'rfid' => 'required|string|max:255|unique:miembros,rfid',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $miembro = Miembro::create([
            'nombre' => $request->nombre,
            'fecha' => $request->fecha,
            'rfid' => $request->rfid,
            'baja' => 0,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear miembro',
            'tabla' => 'miembros',
            'dato' => $miembro->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro creado correctamente',
            'data' => $miembro
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('miembros.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro) {
            return response()->json([
                'success' => false,
                'message' => 'Miembro no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $miembro
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('miembros.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro) {
            return response()->json([
                'success' => false,
                'message' => 'Miembro no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'fecha' => 'required|date',
            'rfid' => 'required|string|max:255|unique:miembros,rfid,' . $miembro->id,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $antes = $miembro->toArray();

        $miembro->update([
            'nombre' => $request->nombre,
            'fecha' => $request->fecha,
            'rfid' => $request->rfid,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro actualizado correctamente',
            'data' => $miembro->fresh()
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('miembros.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro) {
            return response()->json([
                'success' => false,
                'message' => 'Miembro no encontrado'
            ], 404);
        }

        $antes = $miembro->toArray();

        $miembro->update([
            'baja' => 1
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Dar baja miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro dado de baja correctamente'
        ]);
    }

    public function reactivar(string $id)
    {
        if (!User::mySelf()->can('miembros.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro) {
            return response()->json([
                'success' => false,
                'message' => 'Miembro no encontrado'
            ], 404);
        }

        $antes = $miembro->toArray();

        $miembro->update([
            'baja' => 0
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Reactivar miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro reactivado correctamente',
            'data' => $miembro->fresh()
        ]);
    }
}