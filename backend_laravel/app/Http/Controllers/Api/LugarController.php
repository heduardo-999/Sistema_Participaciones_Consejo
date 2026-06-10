<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lugar;
use App\Models\User;
use App\Models\Historial;
use Illuminate\Http\Request;

class LugarController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('lugares.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Lugar::where('baja', 0)->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('lugares.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validated = $request->validate([
            'mesa_id' => 'required|string|max:100|unique:lugares,mesa_id',
            'esp_id' => 'required|string|max:100|unique:lugares,esp_id',
            'status' => 'required|in:funcional,mantenimiento,dañada,denegado',
        ]);

        $lugar = Lugar::create([
            'mesa_id' => $validated['mesa_id'],
            'esp_id' => $validated['esp_id'],
            'status' => $validated['status'],
            'baja' => 0,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear lugar',
            'tabla' => 'lugares',
            'dato' => $lugar->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lugar creado correctamente',
            'data' => $lugar
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('lugares.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $lugar = Lugar::find($id);

        if (!$lugar || $lugar->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $lugar
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('lugares.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $lugar = Lugar::find($id);

        if (!$lugar || $lugar->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar no encontrado'
            ], 404);
        }

        $validated = $request->validate([
            'mesa_id' => 'required|string|max:100|unique:lugares,mesa_id,' . $lugar->id,
            'esp_id' => 'required|string|max:100|unique:lugares,esp_id,' . $lugar->id,
            'status' => 'required|in:funcional,mantenimiento,dañada,denegado',
        ]);

        if (
            $validated['status'] === 'denegado' &&
            !User::mySelf()->hasAnyRole(['super admin', 'admin'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Solo super admin o admin pueden denegar lugares'
            ], 403);
        }

        $antes = $lugar->toArray();

        $lugar->update([
            'mesa_id' => $validated['mesa_id'],
            'esp_id' => $validated['esp_id'],
            'status' => $validated['status'],
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar lugar',
            'tabla' => 'lugares',
            'dato' => [
                'antes' => $antes,
                'despues' => $lugar->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lugar actualizado correctamente',
            'data' => $lugar
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('lugares.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $lugar = Lugar::find($id);

        if (!$lugar || $lugar->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar no encontrado'
            ], 404);
        }

        $antes = $lugar->toArray();

        $lugar->update([
            'baja' => 1
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Dar de baja lugar',
            'tabla' => 'lugares',
            'dato' => [
                'antes' => $antes,
                'despues' => $lugar->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Lugar dado de baja correctamente'
        ]);
    }
}