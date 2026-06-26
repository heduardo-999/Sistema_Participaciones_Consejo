<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Intervencion;
use App\Models\Historial;
use App\Models\User;
use App\Services\SocketService;
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
            'server_now' => now()->toISOString(),
            'data' => Intervencion::with([
                    'participante:id,miembro_id,invitado_id,reunion_id,fecha,status',
                    'participante.miembro:id,nombre,rfid,baja',
                    'participante.invitado:id,nombre,fecha_participacion',
                    'participante.reunion:id,sesion,fecha,status,hora_inicio,hora_fin,inicio_real_at,fin_real_at,intervenciones_pausadas,intervenciones_pausadas_at',
                ])
                ->where('solicita_intervencion', true)
                ->whereIn('status', ['aun no intervino', 'preparando', 'interviniendo'])
                ->orderByRaw("FIELD(status, 'interviniendo', 'preparando', 'aun no intervino')")
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
            'status' => 'required|in:no intervino,aun no intervino,preparando,interviniendo,fin intervencion',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        if (($data['status'] ?? null) === 'preparando') {
            $data['preparacion_inicia_at'] = now();
            $data['inicio_real_at'] = null;
            $data['fin_real_at'] = null;
        }

        if (($data['status'] ?? null) === 'interviniendo') {
            $data['hora_inicio'] = now()->format('H:i:s');
            $data['preparacion_inicia_at'] = null;
            $data['inicio_real_at'] = now();
            $data['fin_real_at'] = null;
        }

        if (($data['status'] ?? null) === 'fin intervencion') {
            $data['hora_fin'] = now()->format('H:i:s');
            $data['fin_real_at'] = now();
        }

        $intervencion = Intervencion::create($data);
        $intervencion->loadMissing('participante.reunion');

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear intervención',
            'tabla' => 'intervenciones',
            'dato' => $intervencion->toArray(),
        ]);

        $this->emitirCambioIntervencion('crear', $intervencion);

        return response()->json([
            'success' => true,
            'message' => 'Intervención creada correctamente',
            'server_now' => now()->toISOString(),
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

        $intervencion = Intervencion::with([
            'participante.miembro',
            'participante.invitado',
            'participante.reunion'
        ])->find($id);

        if (!$intervencion) {
            return response()->json([
                'success' => false,
                'message' => 'Intervención no encontrada'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'server_now' => now()->toISOString(),
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

        $intervencion = Intervencion::with('participante.reunion')->find($id);

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
            'status' => 'sometimes|in:no intervino,aun no intervino,preparando,interviniendo,fin intervencion',
            'preparacion_inicia_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        /*
            Refresh antes de aplicar el cambio para evitar que dos dashboards
            sobrescriban la hora oficial de preparación con tiempos diferentes.
        */
        $intervencion->refresh();

        $antes = $intervencion->toArray();
        $data = $validator->validated();
        $nuevoStatus = $data['status'] ?? null;

        if ($nuevoStatus === 'preparando') {
            $data['hora_inicio'] = null;
            $data['hora_fin'] = null;
            $data['inicio_real_at'] = null;
            $data['fin_real_at'] = null;

            if ($intervencion->status === 'preparando' && $intervencion->preparacion_inicia_at) {
                $data['preparacion_inicia_at'] = $intervencion->preparacion_inicia_at;
            } else {
                $data['preparacion_inicia_at'] = now();
            }
        }

        if ($nuevoStatus === 'interviniendo') {
            $data['hora_inicio'] = $data['hora_inicio'] ?? now()->format('H:i:s');
            $data['inicio_real_at'] = now();
            $data['fin_real_at'] = null;
            $data['preparacion_inicia_at'] = null;
        }

        if ($nuevoStatus === 'fin intervencion') {
            $data['hora_fin'] = $data['hora_fin'] ?? now()->format('H:i:s');
            $data['fin_real_at'] = now();
            $data['preparacion_inicia_at'] = null;
        }

        if (in_array($nuevoStatus, ['no intervino', 'aun no intervino'], true)) {
            $data['hora_inicio'] = null;
            $data['hora_fin'] = null;
            $data['preparacion_inicia_at'] = null;
            $data['inicio_real_at'] = null;
            $data['fin_real_at'] = null;
        }

        $intervencion->update($data);
        $intervencion = $intervencion->fresh()->loadMissing('participante.reunion');

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar intervención',
            'tabla' => 'intervenciones',
            'dato' => [
                'antes' => $antes,
                'despues' => $intervencion->toArray(),
            ],
        ]);

        $this->emitirCambioIntervencion('actualizar', $intervencion);

        return response()->json([
            'success' => true,
            'message' => 'Intervención actualizada correctamente',
            'server_now' => now()->toISOString(),
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

        $intervencion = Intervencion::with('participante.reunion')->find($id);

        if (!$intervencion) {
            return response()->json([
                'success' => false,
                'message' => 'Intervención no encontrada'
            ], 404);
        }

        $antes = $intervencion->toArray();
        $reunionId = $intervencion->participante?->reunion?->id;

        $intervencion->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar intervención',
            'tabla' => 'intervenciones',
            'dato' => $antes,
        ]);

        SocketService::emit('intervenciones:updated', [
            'accion' => 'eliminar',
            'intervencion_id' => $id,
            'reunion_id' => $reunionId,
            'server_now' => now()->toISOString(),
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'eliminar_intervencion',
            'intervencion_id' => $id,
            'reunion_id' => $reunionId,
            'server_now' => now()->toISOString(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervención eliminada correctamente',
            'server_now' => now()->toISOString()
        ]);
    }

    private function emitirCambioIntervencion(string $accion, Intervencion $intervencion): void
    {
        $intervencion->loadMissing('participante.reunion');

        SocketService::emit('intervenciones:updated', [
            'accion' => $accion,
            'intervencion_id' => $intervencion->id,
            'status' => $intervencion->status,
            'reunion_id' => $intervencion->participante?->reunion?->id,
            'preparacion_inicia_at' => $intervencion->preparacion_inicia_at?->toISOString(),
            'inicio_real_at' => $intervencion->inicio_real_at?->toISOString(),
            'fin_real_at' => $intervencion->fin_real_at?->toISOString(),
            'server_now' => now()->toISOString(),
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => "{$accion}_intervencion",
            'intervencion_id' => $intervencion->id,
            'status' => $intervencion->status,
            'reunion_id' => $intervencion->participante?->reunion?->id,
            'server_now' => now()->toISOString(),
        ]);
    }
}
