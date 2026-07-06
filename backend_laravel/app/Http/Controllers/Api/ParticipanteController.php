<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Participante;
use App\Models\Historial;
use App\Models\User;
use App\Models\Reunion;
use App\Models\Miembro;
use App\Services\SocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ParticipanteController extends Controller
{
    public function index(Request $request)
    {
        if (!User::mySelf()->can('participantes.view') && !User::mySelf()->can('reuniones.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $query = Participante::with([
            'miembro',
            'invitado',
            'reunion'
        ]);

        if ($request->filled('reunion_id')) {
            $query->where('reunion_id', $request->reunion_id);
        } else {
            $query->whereHas('reunion', function ($query) {
                $query->where('status', 'activa');
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->orderBy('id', 'desc')->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('participantes.create') && !User::mySelf()->can('reuniones.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'reunion_id' => 'nullable|exists:reuniones,id',
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
            'status' => 'nullable|in:presente,ausente,retirado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        $reunion = null;

        if (!empty($datos['reunion_id'])) {
            $reunion = Reunion::find($datos['reunion_id']);
        } else {
            $reunion = Reunion::where('status', 'activa')
                ->latest('id')
                ->first();
        }

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'No existe una reunión válida para agregar participantes.'
            ], 422);
        }

        if (in_array($reunion->status, ['terminada', 'cancelada'])) {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden agregar participantes a una reunión terminada o cancelada.'
            ], 422);
        }

        if (empty($datos['miembro_id']) && empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado.'
            ], 422);
        }

        if (!empty($datos['miembro_id']) && !empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Solo puedes indicar un miembro o un invitado, no ambos.'
            ], 422);
        }

        $existe = Participante::where('reunion_id', $reunion->id)
            ->when(!empty($datos['miembro_id']), function ($query) use ($datos) {
                $query->where('miembro_id', $datos['miembro_id']);
            })
            ->when(!empty($datos['invitado_id']), function ($query) use ($datos) {
                $query->where('invitado_id', $datos['invitado_id']);
            })
            ->exists();

        if ($existe) {
            return response()->json([
                'success' => false,
                'message' => 'Este participante ya fue agregado a la reunión.'
            ], 422);
        }

        $participante = Participante::create([
            'reunion_id' => $reunion->id,
            'miembro_id' => $datos['miembro_id'] ?? null,
            'invitado_id' => $datos['invitado_id'] ?? null,
            'fecha' => now()->toDateString(),
            'status' => $datos['status'] ?? 'presente',
        ]);

        $participante->load(['miembro', 'invitado', 'reunion']);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear participante',
            'tabla' => 'participantes',
            'dato' => $participante->toArray(),
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'crear',
            'participante_id' => $participante->id,
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'agregar_participante',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'agregar_participante',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante agregado correctamente a la reunión.',
            'data' => $participante
        ], 201);
    }

    public function agregarTodosMiembros(Request $request, string $reunionId)
    {
        if (!User::mySelf()->can('participantes.create') && !User::mySelf()->can('reuniones.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $reunion = Reunion::find($reunionId);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada.'
            ], 404);
        }

        if (in_array($reunion->status, ['terminada', 'cancelada'])) {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden agregar participantes a una reunión terminada o cancelada.'
            ], 422);
        }

        $miembrosAgregados = Participante::where('reunion_id', $reunion->id)
            ->whereNotNull('miembro_id')
            ->pluck('miembro_id')
            ->filter()
            ->values();

        $miembros = Miembro::whereNotIn('id', $miembrosAgregados)->get();

        $creados = [];

        foreach ($miembros as $miembro) {
            $creados[] = Participante::create([
                'reunion_id' => $reunion->id,
                'miembro_id' => $miembro->id,
                'invitado_id' => null,
                'fecha' => now()->toDateString(),
                'status' => 'presente',
            ])->load(['miembro', 'invitado', 'reunion']);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Agregar todos los miembros a reunión',
            'tabla' => 'participantes',
            'dato' => [
                'reunion_id' => $reunion->id,
                'total_agregados' => count($creados),
            ],
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'agregar_todos_miembros',
            'reunion_id' => $reunion->id,
            'total_agregados' => count($creados),
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'agregar_todos_miembros',
            'reunion_id' => $reunion->id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'agregar_todos_miembros',
            'reunion_id' => $reunion->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => count($creados) > 0
                ? 'Miembros agregados correctamente a la reunión.'
                : 'No había miembros nuevos por agregar.',
            'data' => [
                'total_agregados' => count($creados),
                'participantes' => $creados,
            ]
        ]);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('participantes.view') && !User::mySelf()->can('reuniones.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with([
            'miembro',
            'invitado',
            'reunion',
            'intervenciones'
        ])->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $participante
        ]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('participantes.edit') && !User::mySelf()->can('reuniones.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with('reunion')->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        if (!$participante->reunion || in_array($participante->reunion->status, ['terminada', 'cancelada'])) {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden editar participantes de reuniones terminadas o canceladas.'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'miembro_id' => 'nullable|exists:miembros,id',
            'invitado_id' => 'nullable|exists:invitados,id',
            'status' => 'required|in:presente,ausente,retirado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $datos = $validator->validated();

        if (empty($datos['miembro_id']) && empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Debe indicar un miembro o invitado'
            ], 422);
        }

        if (!empty($datos['miembro_id']) && !empty($datos['invitado_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Solo puedes indicar un miembro o un invitado, no ambos'
            ], 422);
        }

        $existe = Participante::where('reunion_id', $participante->reunion_id)
            ->where('id', '!=', $participante->id)
            ->when(!empty($datos['miembro_id']), function ($query) use ($datos) {
                $query->where('miembro_id', $datos['miembro_id']);
            })
            ->when(!empty($datos['invitado_id']), function ($query) use ($datos) {
                $query->where('invitado_id', $datos['invitado_id']);
            })
            ->exists();

        if ($existe) {
            return response()->json([
                'success' => false,
                'message' => 'Este participante ya está agregado a la reunión.'
            ], 422);
        }

        $antes = $participante->toArray();

        $participante->update($datos);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar participante',
            'tabla' => 'participantes',
            'dato' => [
                'antes' => $antes,
                'despues' => $participante->fresh()->load(['miembro', 'invitado', 'reunion'])->toArray(),
            ],
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'actualizar',
            'participante_id' => $participante->id,
            'reunion_id' => $participante->reunion_id,
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'actualizar_participante',
            'reunion_id' => $participante->reunion_id,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'actualizar_participante',
            'reunion_id' => $participante->reunion_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante actualizado correctamente',
            'data' => $participante->fresh()->load(['miembro', 'invitado', 'reunion'])
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('participantes.delete') && !User::mySelf()->can('reuniones.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $participante = Participante::with(['miembro', 'invitado', 'reunion'])->find($id);

        if (!$participante) {
            return response()->json([
                'success' => false,
                'message' => 'Participante no encontrado'
            ], 404);
        }

        if ($participante->reunion && in_array($participante->reunion->status, ['terminada', 'cancelada'])) {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden eliminar participantes de reuniones terminadas o canceladas.'
            ], 422);
        }

        $antes = $participante->toArray();
        $reunionId = $participante->reunion_id;

        $participante->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar participante',
            'tabla' => 'participantes',
            'dato' => $antes,
        ]);

        SocketService::emit('participantes:updated', [
            'accion' => 'eliminar',
            'participante_id' => $id,
            'reunion_id' => $reunionId,
        ]);

        SocketService::emit('reunion:updated', [
            'accion' => 'eliminar_participante',
            'reunion_id' => $reunionId,
        ]);

        SocketService::emit('dashboard:updated', [
            'accion' => 'eliminar_participante',
            'reunion_id' => $reunionId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Participante eliminado correctamente'
        ]);
    }
}
