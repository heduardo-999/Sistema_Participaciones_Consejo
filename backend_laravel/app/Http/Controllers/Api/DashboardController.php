<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Miembro;
use App\Models\Invitado;
use App\Models\Reunion;
use App\Models\Participante;
use App\Models\Intervencion;
use App\Models\LugarAsignado;
use App\Models\Historial;

class DashboardController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'miembros' => Miembro::where('baja', 0)->count(),

                'invitados' => Invitado::count(),

                'reuniones_activas' => Reunion::where('status', 'activa')->count(),

                'participantes_presentes' => Participante::where('status', 'presente')->count(),

                'intervenciones_pendientes' => Intervencion::where('status', 'aun no intervino')->count(),

                'lugares_ocupados' => LugarAsignado::count(),

                'historial_reciente' => Historial::with('user')
                    ->latest()
                    ->take(10)
                    ->get()
            ]
        ]);
    }

public function resumen()
{
    if (!User::mySelf()->can('lugares.view')) {
        return response()->json([
            'success' => false,
            'message' => 'No autorizado'
        ], 403);
    }

    $total = Lugar::where('baja', 0)->count();

    $ocupados = \App\Models\LugarAsignado::whereHas('participante', function ($query) {
        $query->where('status', 'presente');
    })->count();

    $ausentes = \App\Models\LugarAsignado::whereHas('participante', function ($query) {
        $query->where('status', 'ausente');
    })->count();

    return response()->json([
        'success' => true,
        'data' => [
            'total' => $total,
            'ocupados' => $ocupados,
            'ausentes' => $ausentes,
            'disponibles' => $total - $ocupados - $ausentes,
            'funcionales' => Lugar::where('baja', 0)->where('status', 'funcional')->count(),
            'mantenimiento' => Lugar::where('baja', 0)->where('status', 'mantenimiento')->count(),
            'dañadas' => Lugar::where('baja', 0)->where('status', 'dañada')->count(),
            'denegados' => Lugar::where('baja', 0)->where('status', 'denegado')->count(),
        ]
    ]);
}

    public function mapa()
    {
        if (!User::mySelf()->can('lugares.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $lugares = Lugar::where('baja', 0)
            ->with([
                'asignaciones.participante.miembro',
                'asignaciones.participante.invitado',
                'asignaciones.participante.reunion'
            ])
            ->get();

        return response()->json([
            'success' => true,
            'data' => $lugares
        ]);
    }    
}