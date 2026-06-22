<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
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

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear rol',
            'tabla' => 'roles',
            'dato' => [
                'id' => $role->id,
                'nombre' => $role->name,
            ],
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

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear permiso',
            'tabla' => 'permissions',
            'dato' => [
                'id' => $permission->id,
                'nombre' => $permission->name,
            ],
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

        $role = Role::with('permissions')->find($roleId);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        if ($role->name === 'super admin') {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden modificar permisos al super admin.'
            ], 403);
        }

        $validated = $request->validate([
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        $antes = $role->permissions->pluck('name')->values()->toArray();

        $permissions = Permission::whereIn('id', $validated['permission_ids'])->get();

        $despues = $permissions->pluck('name')->values()->toArray();

        $agregados = array_values(array_diff($despues, $antes));
        $quitados = array_values(array_diff($antes, $despues));

        $role->syncPermissions($permissions);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar permisos de rol',
            'tabla' => 'roles_permissions',
            'dato' => [
                'rol' => $role->name,
                'permisos_antes' => $antes,
                'permisos_despues' => $despues,
                'permisos_agregados' => $agregados,
                'permisos_quitados' => $quitados,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Permisos asignados correctamente',
            'data' => [
                'role' => $role->fresh()->load('permissions'),
                'permission_ids' => $validated['permission_ids'],
            ]
        ]);
    }

    public function destroyRole(string $id)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $role = Role::with('permissions')->find($id);

        if (!$role) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        if ($role->name === 'super admin') {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar el rol super admin.'
            ], 403);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar rol',
            'tabla' => 'roles',
            'dato' => [
                'id' => $role->id,
                'nombre' => $role->name,
                'permisos' => $role->permissions->pluck('name')->values()->toArray(),
            ],
        ]);

        $role->permissions()->detach();
        $role->users()->detach();
        $role->delete();

        return response()->json([
            'success' => true,
            'message' => 'Rol eliminado correctamente'
        ]);
    }

    public function destroyPermission(string $id)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $permission = Permission::find($id);

        if (!$permission) {
            return response()->json([
                'success' => false,
                'message' => 'Permiso no encontrado'
            ], 404);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar permiso',
            'tabla' => 'permissions',
            'dato' => [
                'id' => $permission->id,
                'nombre' => $permission->name,
            ],
        ]);

        $permission->roles()->detach();
        $permission->users()->detach();
        $permission->delete();

        return response()->json([
            'success' => true,
            'message' => 'Permiso eliminado correctamente'
        ]);
    }
}