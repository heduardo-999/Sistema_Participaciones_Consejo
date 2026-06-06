<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;

class HistorialController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('historial.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Historial::with('user')
                ->latest()
                ->get()
        ]);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('historial.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $historial = Historial::with('user')->find($id);

        if (!$historial) {
            return response()->json([
                'success' => false,
                'message' => 'Historial no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $historial
        ]);
    }

    public function store(Request $request)
    {
        return response()->json([
            'success' => false,
            'message' => 'El historial se genera automáticamente'
        ], 403);
    }

    public function update(Request $request, string $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'No se permite modificar historial'
        ], 403);
    }

    public function destroy(string $id)
    {
        return response()->json([
            'success' => false,
            'message' => 'No se permite eliminar historial'
        ], 403);
    }
}