<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Historial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function index()
    {
        $authUser = User::mySelf();

        if (!$authUser->can('users.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        if ($authUser->hasRole('super admin')) {
            $users = User::with('roles')->get();
        } elseif ($authUser->hasRole('admin')) {
            $users = User::role('moderador')->with('roles')->get();
        } elseif ($authUser->hasRole('moderador')) {
            $users = User::with('roles')->get();
        } else {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }

    public function store(Request $request)
    {
        $authUser = User::mySelf();

        if (!$authUser->can('users.create')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|exists:roles,name',
            'baja' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->role === 'super admin' && !$authUser->hasRole('super admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Solo un super admin puede crear otro super admin'
            ], 403);
        }

        if ($authUser->hasRole('admin') && $request->role !== 'moderador') {
            return response()->json([
                'success' => false,
                'message' => 'El administrador solo puede crear usuarios moderadores'
            ], 403);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'baja' => $request->baja ?? 0,
        ]);

        $user->assignRole($request->role);

        Historial::create([
            'user_id' => $authUser->id,
            'operacion' => 'Crear usuario',
            'tabla' => 'users',
            'dato' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $request->role,
                'baja' => $user->baja,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Usuario creado correctamente',
            'data' => $user->load('roles')
        ], 201);
    }

    public function show(string $id)
    {
        $authUser = User::mySelf();

        if (!$authUser->can('users.view')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $user = User::with('roles')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        if ($authUser->hasRole('admin') && !$user->hasRole('moderador')) {
            return response()->json([
                'success' => false,
                'message' => 'El administrador solo puede ver moderadores'
            ], 403);
        }

        if (!$authUser->hasRole('super admin') && !$authUser->hasRole('admin')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $user
        ]);
    }

    public function update(Request $request, string $id)
    {
        $authUser = User::mySelf();

        if (!$authUser->can('users.edit')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $user = User::with('roles')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        if ($authUser->hasRole('admin') && !$user->hasRole('moderador')) {
            return response()->json([
                'success' => false,
                'message' => 'El administrador solo puede editar moderadores'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8',
            'role' => 'nullable|exists:roles,name',
            'baja' => 'nullable|in:0,1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        if ($request->filled('role') && $request->role === 'super admin' && !$authUser->hasRole('super admin')) {
            return response()->json([
                'success' => false,
                'message' => 'Solo un super admin puede asignar el rol super admin'
            ], 403);
        }

        if ($authUser->hasRole('admin') && $request->filled('role') && $request->role !== 'moderador') {
            return response()->json([
                'success' => false,
                'message' => 'El administrador no puede cambiar usuarios a admin o super admin'
            ], 403);
        }

        $antes = $user->load('roles')->toArray();

        $user->name = $request->name;
        $user->email = $request->email;

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        if ($request->has('baja')) {
            $user->baja = $request->baja;
        }

        $user->save();

        if ($request->filled('role')) {
            $user->syncRoles([$request->role]);
        }

        Historial::create([
            'user_id' => $authUser->id,
            'operacion' => 'Actualizar usuario',
            'tabla' => 'users',
            'dato' => [
                'antes' => $antes,
                'despues' => $user->load('roles')->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Usuario actualizado correctamente',
            'data' => $user->load('roles')
        ]);
    }

    public function destroy(string $id)
    {
        $authUser = User::mySelf();

        if (!$authUser->can('users.delete')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado'
            ], 403);
        }

        $user = User::with('roles')->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        if ((int) $authUser->id === (int) $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'No puedes darte de baja a ti mismo'
            ], 403);
        }

        if ($authUser->hasRole('admin') && !$user->hasRole('moderador')) {
            return response()->json([
                'success' => false,
                'message' => 'El administrador solo puede eliminar moderadores'
            ], 403);
        }

        $antes = $user->load('roles')->toArray();

        $user->update([
            'baja' => 1
        ]);

        Historial::create([
            'user_id' => $authUser->id,
            'operacion' => 'Dar de baja usuario',
            'tabla' => 'users',
            'dato' => [
                'antes' => $antes,
                'despues' => $user->load('roles')->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Usuario dado de baja correctamente',
            'data' => $user->load('roles')
        ]);
    }
}