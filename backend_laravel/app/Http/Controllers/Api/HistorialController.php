<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;

class HistorialController extends Controller
{
    public function index(Request $request)
    {
        if (!User::mySelf()->can('historial.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $query = Historial::with('user')
            ->where('user_id', User::mySelf()->id);

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('created_at', '>=', $request->fecha_inicio);
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('created_at', '<=', $request->fecha_fin);
        }

        $historial = $query
            ->latest()
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $historial
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

        $historial = Historial::with('user')
            ->where('user_id', User::mySelf()->id)
            ->find($id);

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