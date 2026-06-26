<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TemaReunion;
use App\Models\Reunion;
use App\Models\Historial;
use App\Models\User;
use App\Services\SocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TemaReunionController extends Controller
{
    public function index(Request $request)
    {
        $query = TemaReunion::with('reunion:id,sesion,fecha,status')
            ->orderBy('orden', 'asc')
            ->orderBy('id', 'asc');

        if ($request->filled('reunion_id')) {
            $query->where('reunion_id', $request->reunion_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reunion_id' => 'required|exists:reuniones,id',
            'titulo' => 'required|string|max:180',
            'descripcion' => 'nullable|string',
            'orden' => 'nullable|integer|min:1',
            'status' => 'nullable|in:pendiente,en_curso,completado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        if (empty($data['orden'])) {
            $ultimoOrden = TemaReunion::where('reunion_id', $data['reunion_id'])
                ->max('orden');

            $data['orden'] = ($ultimoOrden ?? 0) + 1;
        }

        $data['status'] = $data['status'] ?? 'pendiente';

        if ($data['status'] === 'completado') {
            $data['completado_at'] = now();
        }

        $tema = TemaReunion::create($data);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear tema de reunión',
            'tabla' => 'temas_reunion',
            'dato' => $tema->toArray(),
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'crear',
            'tema_id' => $tema->id,
            'reunion_id' => $tema->reunion_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tema creado correctamente',
            'data' => $tema->load('reunion:id,sesion,fecha,status')
        ], 201);
    }

    public function show(string $id)
    {
        $tema = TemaReunion::with('reunion:id,sesion,fecha,status')->find($id);

        if (!$tema) {
            return response()->json([
                'success' => false,
                'message' => 'Tema no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $tema
        ]);
    }

    public function update(Request $request, string $id)
    {
        $tema = TemaReunion::find($id);

        if (!$tema) {
            return response()->json([
                'success' => false,
                'message' => 'Tema no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'titulo' => 'sometimes|required|string|max:180',
            'descripcion' => 'nullable|string',
            'orden' => 'sometimes|integer|min:1',
            'status' => 'sometimes|in:pendiente,en_curso,completado',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $antes = $tema->toArray();
        $data = $validator->validated();

        if (($data['status'] ?? null) === 'completado') {
            $data['completado_at'] = now();
        }

        if (isset($data['status']) && $data['status'] !== 'completado') {
            $data['completado_at'] = null;
        }

        $tema->update($data);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar tema de reunión',
            'tabla' => 'temas_reunion',
            'dato' => [
                'antes' => $antes,
                'despues' => $tema->fresh()->toArray(),
            ],
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'actualizar',
            'tema_id' => $tema->id,
            'reunion_id' => $tema->reunion_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tema actualizado correctamente',
            'data' => $tema->fresh()->load('reunion:id,sesion,fecha,status')
        ]);
    }

    public function destroy(string $id)
    {
        $tema = TemaReunion::find($id);

        if (!$tema) {
            return response()->json([
                'success' => false,
                'message' => 'Tema no encontrado'
            ], 404);
        }

        $antes = $tema->toArray();

        $tema->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar tema de reunión',
            'tabla' => 'temas_reunion',
            'dato' => $antes,
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'eliminar',
            'tema_id' => $id,
            'reunion_id' => $antes['reunion_id'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tema eliminado correctamente'
        ]);
    }

    public function actual(string $reunionId)
    {
        $reunion = Reunion::find($reunionId);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        if ($reunion->status !== 'activa') {
            return response()->json([
                'success' => true,
                'message' => 'La reunión no está activa',
                'data' => null
            ]);
        }

        $tema = TemaReunion::where('reunion_id', $reunionId)
            ->where('status', 'en_curso')
            ->orderBy('orden', 'asc')
            ->orderBy('id', 'asc')
            ->first();

        if (!$tema) {
            $tema = TemaReunion::where('reunion_id', $reunionId)
                ->where('status', 'pendiente')
                ->orderBy('orden', 'asc')
                ->orderBy('id', 'asc')
                ->first();

            if ($tema) {
                $tema->update([
                    'status' => 'en_curso',
                    'completado_at' => null,
                ]);

                SocketService::emit('tema:updated', [
                    'accion' => 'iniciar_tema_actual',
                    'tema_id' => $tema->id,
                    'reunion_id' => $tema->reunion_id,
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $tema
        ]);
    }

    public function completar(string $id)
    {
        $tema = TemaReunion::find($id);

        if (!$tema) {
            return response()->json([
                'success' => false,
                'message' => 'Tema no encontrado'
            ], 404);
        }

        $tema->update([
            'status' => 'completado',
            'completado_at' => now(),
        ]);

        $siguiente = TemaReunion::where('reunion_id', $tema->reunion_id)
            ->where('status', 'pendiente')
            ->orderBy('orden', 'asc')
            ->orderBy('id', 'asc')
            ->first();

        if ($siguiente) {
            $siguiente->update([
                'status' => 'en_curso',
                'completado_at' => null,
            ]);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Completar tema de reunión',
            'tabla' => 'temas_reunion',
            'dato' => [
                'tema_completado' => $tema->fresh()->toArray(),
                'siguiente_tema' => $siguiente?->fresh()?->toArray(),
            ],
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'completar',
            'tema_id' => $tema->id,
            'siguiente_tema_id' => $siguiente?->id,
            'reunion_id' => $tema->reunion_id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Tema completado correctamente',
            'data' => [
                'tema_completado' => $tema->fresh(),
                'siguiente_tema' => $siguiente?->fresh(),
            ]
        ]);
    }

    public function reiniciarTemas(string $reunionId)
    {
        $reunion = Reunion::find($reunionId);

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'Reunión no encontrada'
            ], 404);
        }

        TemaReunion::where('reunion_id', $reunionId)->update([
            'status' => 'pendiente',
            'completado_at' => null,
        ]);

        SocketService::emit('tema:updated', [
            'accion' => 'reiniciar',
            'reunion_id' => $reunionId,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Temas reiniciados correctamente'
        ]);
    }
}