<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolPermisoController extends Controller
{
    private function soloSuperAdmin()
    {
        if (!User::mySelf()->hasRole('super admin')) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado. Solo super admin.'
            ], 403);
        }

        return true;
    }

    public function roles()
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        return response()->json([
            'success' => true,
            'data' => Role::orderBy('id')->get()
        ]);
    }

    public function permissions()
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        return response()->json([
            'success' => true,
            'data' => Permission::orderBy('name')->get()
        ]);
    }

    public function storeRole(Request $request)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
        ]);

        $role = Role::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Rol creado correctamente',
            'data' => $role
        ], 201);
    }

    public function storePermission(Request $request)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:permissions,name',
        ]);

        $permission = Permission::create([
            'name' => $validated['name'],
            'guard_name' => 'web',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permiso creado correctamente',
            'data' => $permission
        ], 201);
    }

    public function permissionsPorRol(string $roleId)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $role = Role::with('permissions')->find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'role' => $role,
                'permission_ids' => $role->permissions->pluck('id')->values(),
            ]
        ]);
    }

    public function syncPermissions(Request $request, string $roleId)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $role = Role::find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        $validated = $request->validate([
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        $permissions = Permission::whereIn('id', $validated['permission_ids'])->get();

        $role->syncPermissions($permissions);

        if ($role->name === 'super admin') {
    return response()->json([
        'success' => false,
        'message' => 'No se pueden quitar permisos al super admin.'
    ], 403);
}

        return response()->json([
            'success' => true,
            'message' => 'Permisos asignados correctamente',
            'data' => [
                'role' => $role->load('permissions'),
                'permission_ids' => $validated['permission_ids'],
            ]
        ]);
    }
}