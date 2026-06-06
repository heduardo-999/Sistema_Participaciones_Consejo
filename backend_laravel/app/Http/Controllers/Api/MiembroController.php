<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Miembro;
use App\Models\Historial;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class MiembroController extends Controller
{
    public function index()
    {
        if (!User::mySelf()->can('miembros.view')) {
            return response()->json(['success' => false, 'message' => 'No autorizado'], 403);
        }

        return response()->json([
            'success' => true,
            'data' => Miembro::where('baja', 0)->get()
        ]);
    }

    public function store(Request $request)
    {
        if (!User::mySelf()->can('miembros.create')) {
            return response()->json(['success' => false, 'message' => 'No autorizado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'fecha' => 'required|date',
            'rfid' => 'nullable|string|max:100|unique:miembros,rfid',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $miembro = Miembro::create([
            'nombre' => $request->nombre,
            'fecha' => $request->fecha,
            'baja' => 0,
            'rfid' => $request->rfid,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear miembro',
            'tabla' => 'miembros',
            'dato' => $miembro->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro creado correctamente',
            'data' => $miembro
        ], 201);
    }

    public function show(string $id)
    {
        if (!User::mySelf()->can('miembros.view')) {
            return response()->json(['success' => false, 'message' => 'No autorizado'], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro || $miembro->baja == 1) {
            return response()->json(['success' => false, 'message' => 'Miembro no encontrado'], 404);
        }

        return response()->json(['success' => true, 'data' => $miembro]);
    }

    public function update(Request $request, string $id)
    {
        if (!User::mySelf()->can('miembros.edit')) {
            return response()->json(['success' => false, 'message' => 'No autorizado'], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro || $miembro->baja == 1) {
            return response()->json(['success' => false, 'message' => 'Miembro no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:100',
            'fecha' => 'required|date',
            'rfid' => 'nullable|string|max:100|unique:miembros,rfid,' . $miembro->id,
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $antes = $miembro->toArray();

        $miembro->update([
            'nombre' => $request->nombre,
            'fecha' => $request->fecha,
            'rfid' => $request->rfid,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro actualizado correctamente',
            'data' => $miembro
        ]);
    }

    public function destroy(string $id)
    {
        if (!User::mySelf()->can('miembros.delete')) {
            return response()->json(['success' => false, 'message' => 'No autorizado'], 403);
        }

        $miembro = Miembro::find($id);

        if (!$miembro || $miembro->baja == 1) {
            return response()->json(['success' => false, 'message' => 'Miembro no encontrado'], 404);
        }

        $antes = $miembro->toArray();

        $miembro->update(['baja' => 1]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Dar de baja miembro',
            'tabla' => 'miembros',
            'dato' => [
                'antes' => $antes,
                'despues' => $miembro->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Miembro dado de baja correctamente'
        ]);
    }
}
