<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reunion;
use App\Models\Historial;
use App\Models\User;
use App\Models\Intervencion;
use App\Models\LugarAsignado;
use App\Models\Participante;
use App\Models\TemaReunion;
use App\Services\SocketService;
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
            'server_now' => now()->toISOString(),
            'data' => Reunion::orderBy('id', 'desc')->get()
        ]);
    }

    public function activa()
    {
        $reunion = Reunion::where('status', 'activa')
            ->latest('id')
            ->first();

        if (!$reunion) {
            $reunion = Reunion::where('status', 'programada')
                ->latest('id')
                ->first();
        }

        return response()->json([
            'success' => true,
            'server_now' => now()->toISOString(),
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
            'sesion' => 'required|string|max:100',
            'fecha' => 'required|date',
            'status' => 'nullable|in:programada,activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable',
            'hora_fin' => 'nullable',
            'intervenciones_automaticas' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        $data['status'] = $data['status'] ?? 'programada';
        $data['intervenciones_pausadas'] = false;
        $data['intervenciones_pausadas_at'] = null;
        $data['intervenciones_automaticas'] = $data['intervenciones_automaticas'] ?? false;

        if ($data['status'] === 'activa') {
            $data['inicio_real_at'] = now();
            $data['fin_real_at'] = null;
        }

        $reunion = Reunion::create($data);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear reunión',
            'tabla' => 'reuniones',
            'dato' => $reunion->toArray(),
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'crear',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'crear_reunion',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión creada correctamente',
            'server_now' => now()->toISOString(),
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
            'server_now' => now()->toISOString(),
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
            'sesion' => 'required|string|max:100',
            'fecha' => 'required|date',
            'status' => 'required|in:programada,activa,terminada,cancelada,pospuesta',
            'hora_inicio' => 'nullable',
            'hora_fin' => 'nullable',
            'intervenciones_automaticas' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $antes = $reunion->toArray();
        $data = $validator->validated();

        if ($data['status'] === 'activa' && !$reunion->inicio_real_at) {
            $data['inicio_real_at'] = now();
            $data['fin_real_at'] = null;
            $data['intervenciones_pausadas'] = false;
            $data['intervenciones_pausadas_at'] = null;
        }

        if ($data['status'] === 'programada') {
            $data['inicio_real_at'] = null;
            $data['fin_real_at'] = null;
            $data['intervenciones_pausadas'] = false;
            $data['intervenciones_pausadas_at'] = null;
        }

        if ($data['status'] === 'terminada' && !$reunion->fin_real_at) {
            $data['fin_real_at'] = now();
            $data['intervenciones_pausadas'] = false;
            $data['intervenciones_pausadas_at'] = null;
        }

        if (in_array($data['status'], ['cancelada', 'pospuesta'])) {
            $data['intervenciones_pausadas'] = false;
            $data['intervenciones_pausadas_at'] = null;
        }

        $reunion->update($data);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar reunión',
            'tabla' => 'reuniones',
            'dato' => [
                'antes' => $antes,
                'despues' => $reunion->fresh()->toArray(),
            ],
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'actualizar',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'actualizar_reunion',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión actualizada correctamente',
            'server_now' => now()->toISOString(),
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
            'inicio_real_at' => now(),
            'fin_real_at' => null,
            'intervenciones_pausadas' => false,
            'intervenciones_pausadas_at' => null,
            'intervenciones_automaticas' => false,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Iniciar reunión',
            'tabla' => 'reuniones',
            'dato' => $reunion->fresh()->toArray(),
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'iniciar',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('intervenciones:updated', [
            'accion' => 'iniciar_reunion',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'iniciar_reunion',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión iniciada correctamente',
            'server_now' => now()->toISOString(),
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

        TemaReunion::where('reunion_id', $reunion->id)
            ->where('status', 'en_curso')
            ->update([
                'status' => 'pendiente',
                'completado_at' => null,
            ]);

        $horaFin = now()->format('H:i:s');

        $participantesIds = Participante::where('reunion_id', $id)
            ->pluck('id');

        LugarAsignado::whereIn('participante_id', $participantesIds)
            ->delete();

        Intervencion::whereHas('participante', function ($query) use ($id) {
            $query->where('reunion_id', $id);
        })
            ->whereIn('status', [
                'aun no intervino',
                'preparando',
                'interviniendo'
            ])
            ->update([
                'status' => 'fin intervencion',
                'hora_fin' => $horaFin,
                'fin_real_at' => now(),
            ]);

        $reunion->update([
            'status' => 'terminada',
            'fin_real_at' => now(),
            'intervenciones_pausadas' => false,
            'intervenciones_pausadas_at' => null,
            'intervenciones_automaticas' => false,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Terminar reunión',
            'tabla' => 'reuniones',
            'dato' => [
                'reunion' => $reunion->fresh()->toArray(),
                'lugares_liberados' => $participantesIds->count(),
                'intervenciones_finalizadas' => true,
            ],
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'terminar',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('intervenciones:updated', [
            'accion' => 'finalizar_todas',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('lugares:updated', [
            'accion' => 'liberar_por_fin_reunion',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'finalizar_reunion',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'terminar_reunion',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión terminada correctamente. Intervenciones finalizadas y lugares liberados.',
            'server_now' => now()->toISOString(),
            'data' => $reunion->fresh()
        ]);
    }


    public function toggleIntervencionesAutomaticas(string $id)
    {
        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        if ($reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden cambiar las intervenciones automáticas en una reunión activa.'
            ], 422);
        }

        $antes = $reunion->toArray();

        $reunion->update([
            'intervenciones_automaticas' => !$reunion->intervenciones_automaticas,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => $reunion->fresh()->intervenciones_automaticas
                ? 'Activar intervenciones automáticas'
                : 'Desactivar intervenciones automáticas',
            'tabla' => 'reuniones',
            'dato' => [
                'antes' => $antes,
                'despues' => $reunion->fresh()->toArray(),
            ],
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'toggle_intervenciones_automaticas',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('intervenciones:updated', [
            'accion' => 'toggle_intervenciones_automaticas',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'toggle_intervenciones_automaticas',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => $reunion->fresh()->intervenciones_automaticas
                ? 'Intervenciones automáticas activadas'
                : 'Intervenciones automáticas desactivadas',
            'server_now' => now()->toISOString(),
            'data' => $reunion->fresh()
        ]);
    }

    public function togglePausaIntervenciones(string $id)
    {
        $reunion = Reunion::find($id);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        if ($reunion->status !== 'activa') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden pausar intervenciones en una reunión activa.'
            ], 422);
        }

        $antes = $reunion->toArray();

        if (!$reunion->intervenciones_pausadas) {
            $reunion->update([
                'intervenciones_pausadas' => true,
                'intervenciones_pausadas_at' => now(),
            ]);

            Historial::create([
                'user_id' => User::mySelf()->id,
                'operacion' => 'Pausar intervenciones',
                'tabla' => 'reuniones',
                'dato' => [
                    'antes' => $antes,
                    'despues' => $reunion->fresh()->toArray(),
                ],
            ]);

            SocketService::emit('reunion:updated', [
                'accion' => 'pausar_intervenciones',
                'reunion_id' => $reunion->id,
            ]);

            SocketService::emit('intervenciones:updated', [
                'accion' => 'pausar',
                'reunion_id' => $reunion->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Intervenciones pausadas',
                'server_now' => now()->toISOString(),
                'data' => $reunion->fresh()
            ]);
        }

        $pausadoDesde = $reunion->intervenciones_pausadas_at;

        if ($pausadoDesde) {
            $segundosPausados = $pausadoDesde->diffInSeconds(now());

            $intervencionActiva = Intervencion::whereHas('participante', function ($query) use ($reunion) {
                $query->where('reunion_id', $reunion->id);
            })
                ->where('status', 'interviniendo')
                ->latest('id')
                ->first();

            if ($intervencionActiva && $intervencionActiva->inicio_real_at) {
                $intervencionActiva->update([
                    'inicio_real_at' => $intervencionActiva->inicio_real_at->copy()->addSeconds($segundosPausados),
                ]);
            }
        }

        $reunion->update([
            'intervenciones_pausadas' => false,
            'intervenciones_pausadas_at' => null,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Reanudar intervenciones',
            'tabla' => 'reuniones',
            'dato' => [
                'antes' => $antes,
                'despues' => $reunion->fresh()->toArray(),
            ],
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'reanudar_intervenciones',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('intervenciones:updated', [
            'accion' => 'reanudar',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intervenciones reanudadas',
            'server_now' => now()->toISOString(),
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

        SocketService::emit('reunion:updated', [
            'accion' => 'eliminar',
            'reunion_id' => $id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'eliminar_reunion',
            'reunion_id' => $id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Reunión eliminada correctamente',
            'server_now' => now()->toISOString()
        ]);
    }
}