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

        $query = Historial::with('user');

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('created_at', '>=', $request->fecha_inicio);
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('created_at', '<=', $request->fecha_fin);
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest()->paginate(10)
        ]);
    }

    public function show(Request $request, string $user_id)
    {
        if (!User::mySelf()->can('historial.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $query = Historial::with('user')
            ->where('user_id', $user_id);

        if ($request->filled('fecha_inicio')) {
            $query->whereDate('created_at', '>=', $request->fecha_inicio);
        }

        if ($request->filled('fecha_fin')) {
            $query->whereDate('created_at', '<=', $request->fecha_fin);
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest()->paginate(10)
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