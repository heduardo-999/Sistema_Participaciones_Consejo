<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Intervencion;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class IntervencionController extends Controller
{
public function index()
{
    if (!User::mySelf()->can('intervenciones.view')) {
        return response()->json([
            'success' => false,
            'message' => 'No autorizado'
        ], 403);
    }

    return response()->json([
        'success' => true,
        'data' => Intervencion::with([
                'participante:id,miembro_id,invitado_id,reunion_id,fecha,status',
                'participante.miembro:id,nombre,rfid,baja',
                'participante.invitado:id,nombre,fecha_participacion',
                'participante.reunion:id,sesion,fecha,status,hora_inicio,hora_fin',
            ])
            ->where('solicita_intervencion', true)
            ->whereIn('status', ['aun no intervino', 'interviniendo'])
            ->orderByRaw("FIELD(status, 'interviniendo', 'aun no intervino')")
            ->orderBy('created_at', 'asc')
            ->get()
    ]);
}

    public function store(Request $request)
    {
        if (!User::mySelf()->can('intervenciones.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'participante_id' => 'required|exists:participantes,id',
            'solicita_intervencion' => 'required|boolean',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
            'status' => 'required|in:no intervino,aun no intervino,interviniendo,fin intervencion',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $intervencion = Intervencion::create(
            $validator->validated()
        );

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear intervención',
            'tabla' => 'intervenciones',
            'dato' => $intervencion->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervención creada correctamente',
            'data' => $intervencion
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('intervenciones.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $intervencion = Intervencion::with('participante')->find($id);

        if (!$intervencion) {
            return response()->json([
                'success' => false,
                'message' => 'Intervención no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $intervencion
        ]);
    }

public function update(Request $request, string $id)
{
    if (!User::mySelf()->can('intervenciones.edit')) {
        return response()->json([
            'success' => false,
            'message' => 'No autorizado'
        ], 403);
    }

    $intervencion = Intervencion::find($id);

    if (!$intervencion) {
        return response()->json([
            'success' => false,
            'message' => 'Intervención no encontrada'
        ], 404);
    }

    $validator = Validator::make($request->all(), [
        'participante_id' => 'sometimes|exists:participantes,id',
        'solicita_intervencion' => 'sometimes|boolean',
        'hora_inicio' => 'nullable|date_format:H:i:s',
        'hora_fin' => 'nullable|date_format:H:i:s',
        'status' => 'sometimes|in:no intervino,aun no intervino,interviniendo,fin intervencion',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors()
        ], 422);
    }

    $antes = $intervencion->toArray();

    $intervencion->update($validator->validated());

    Historial::create([
        'user_id' => User::mySelf()->id,
        'operacion' => 'Actualizar intervención',
        'tabla' => 'intervenciones',
        'dato' => [
            'antes' => $antes,
            'despues' => $intervencion->toArray(),
        ],
    ]);

    return response()->json([
        'success' => true,
        'message' => 'Intervención actualizada correctamente',
        'data' => $intervencion
    ]);
}

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('intervenciones.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $intervencion = Intervencion::find($id);

        if (!$intervencion) {
            return response()->json([
                'success' => false,
                'message' => 'Intervención no encontrada'
            ], 404);
        }

        $antes = $intervencion->toArray();

        $intervencion->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar intervención',
            'tabla' => 'intervenciones',
            'dato' => $antes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervención eliminada correctamente'
        ]);
    }
}