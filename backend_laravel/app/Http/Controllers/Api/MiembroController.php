<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Miembro;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MiembroController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('miembros.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Miembro::orderBy('baja')->orderBy('nombre')->get()
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

        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
            'fecha' => 'required|date',
            'rfid' => 'required|string|max:100|unique:miembros,rfid',
        ]);

        $miembro = Miembro::create([
            'nombre' => $validated['nombre'],
            'fecha' => $validated['fecha'],
            'rfid' => $validated['rfid'],
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

        $validated = $request->validate([
            'nombre' => 'required|string|max:100',
            'fecha' => 'required|date',
            'rfid' => [
                'required',
                'string',
                'max:100',
                Rule::unique('miembros', 'rfid')->ignore($miembro->id),
            ],
        ]);

        $antes = $miembro->toArray();

        $miembro->update([
            'nombre' => $validated['nombre'],
            'fecha' => $validated['fecha'],
            'rfid' => $validated['rfid'],
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

    public function reactivar(string $id)
    {
        $user = User::mySelf();

        if (!$user->hasAnyRole(['super admin', 'admin'])) {
            return response()->json([
                'success' => false,
                'message' => 'Solo admin o super admin pueden reactivar miembros'
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
            'user_id' => $user->id,
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
            'operacion' => 'Dar de baja miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro dado de baja correctamente',
            'data' => $miembro->fresh()
        ]);
    }
}