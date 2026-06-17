<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\RoleMenu;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class MenuRolController extends Controller
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

    public function menus()
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        return response()->json([
            'success' => true,
            'data' => Menu::where('baja', 0)
                ->whereNotIn('url', [
                    '/menus-roles',
                    '/roles-permisos',
                    '/lugares-asignados',
                ])
                ->orderBy('id')
                ->get()
        ]);
    }

    public function storeMenu(Request $request)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'url' => 'required|string|max:255',
            'icono' => 'nullable|string|max:50',
            'baja' => 'nullable|in:0,1',
        ]);

        $menu = Menu::create([
            'nombre' => $validated['nombre'],
            'url' => $validated['url'],
            'icono' => $validated['icono'] ?? '•',
            'baja' => $validated['baja'] ?? 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Menú creado correctamente',
            'data' => $menu
        ], 201);
    }

    public function updateMenu(Request $request, string $id)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $menu = Menu::find($id);

        if (!$menu) {
            return response()->json([
                'success' => false,
                'message' => 'Menú no encontrado'
            ], 404);
        }

        $validated = $request->validate([
            'nombre' => 'required|string|max:255',
            'url' => 'required|string|max:255',
            'icono' => 'nullable|string|max:50',
            'baja' => 'nullable|in:0,1',
        ]);

        $menu->update([
            'nombre' => $validated['nombre'],
            'url' => $validated['url'],
            'icono' => $validated['icono'] ?? $menu->icono,
            'baja' => $validated['baja'] ?? $menu->baja,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Menú actualizado correctamente',
            'data' => $menu
        ]);
    }

    public function destroyMenu(string $id)
    {
        $auth = $this->soloSuperAdmin();
        if ($auth !== true) return $auth;

        $menu = Menu::find($id);

        if (!$menu) {
            return response()->json([
                'success' => false,
                'message' => 'Menú no encontrado'
            ], 404);
        }

        $menu->update([
            'baja' => 1
        ]);

        RoleMenu::where('menu_id', $menu->id)->delete();

        return response()->json([
            'success' => true,
            'message' => 'Menú dado de baja correctamente'
        ]);
    }

    public function menusPorRol(string $roleId)
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

        $menusAsignados = RoleMenu::where('role_id', $role->id)
            ->pluck('menu_id')
            ->map(fn ($id) => (int) $id)
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'role' => $role,
                'menu_ids' => $menusAsignados
            ]
        ]);
    }

    public function syncMenus(Request $request, string $roleId)
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

        if ($role->name === 'super admin') {
            return response()->json([
                'success' => false,
                'message' => 'No se pueden modificar los menús del super admin.'
            ], 403);
        }

        $validated = $request->validate([
            'menu_ids' => 'required|array',
            'menu_ids.*' => 'exists:menus,id',
        ]);

        $menuIdsPermitidos = Menu::where('baja', 0)
            ->whereNotIn('url', [
                '/menus-roles',
                '/roles-permisos',
                '/lugares-asignados',
            ])
            ->whereIn('id', $validated['menu_ids'])
            ->pluck('id')
            ->toArray();

        RoleMenu::where('role_id', $role->id)->delete();

        foreach ($menuIdsPermitidos as $menuId) {
            RoleMenu::create([
                'role_id' => $role->id,
                'menu_id' => $menuId,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Menús asignados correctamente',
            'data' => [
                'role' => $role,
                'menu_ids' => $menuIdsPermitidos
            ]
        ]);
    }
}