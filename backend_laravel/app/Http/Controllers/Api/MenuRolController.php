<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
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

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Crear menú',
            'tabla' => 'menus',
            'dato' => [
                'id' => $menu->id,
                'nombre' => $menu->nombre,
                'url' => $menu->url,
                'icono' => $menu->icono,
            ],
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

        $antes = $menu->toArray();

        $menu->update([
            'nombre' => $validated['nombre'],
            'url' => $validated['url'],
            'icono' => $validated['icono'] ?? $menu->icono,
            'baja' => $validated['baja'] ?? $menu->baja,
        ]);

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar menú',
            'tabla' => 'menus',
            'dato' => [
                'antes' => $antes,
                'despues' => $menu->fresh()->toArray(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Menú actualizado correctamente',
            'data' => $menu->fresh()
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

        $antes = $menu->toArray();

        $menu->update([
            'baja' => 1
        ]);

        RoleMenu::where('menu_id', $menu->id)->delete();

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Eliminar menú',
            'tabla' => 'menus',
            'dato' => [
                'antes' => $antes,
                'despues' => $menu->fresh()->toArray(),
            ],
        ]);

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

        $menuIdsAntes = RoleMenu::where('role_id', $role->id)
            ->pluck('menu_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $menusAntes = Menu::whereIn('id', $menuIdsAntes)
            ->orderBy('id')
            ->pluck('nombre')
            ->values()
            ->toArray();

        $menuIdsPermitidos = Menu::where('baja', 0)
            ->whereNotIn('url', [
                '/menus-roles',
                '/roles-permisos',
                '/lugares-asignados',
            ])
            ->whereIn('id', $validated['menu_ids'])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $menusDespues = Menu::whereIn('id', $menuIdsPermitidos)
            ->orderBy('id')
            ->pluck('nombre')
            ->values()
            ->toArray();

        $menusAgregados = array_values(array_diff($menusDespues, $menusAntes));
        $menusQuitados = array_values(array_diff($menusAntes, $menusDespues));

        RoleMenu::where('role_id', $role->id)->delete();

        foreach ($menuIdsPermitidos as $menuId) {
            RoleMenu::create([
                'role_id' => $role->id,
                'menu_id' => $menuId,
            ]);
        }

        Historial::create([
            'user_id' => User::mySelf()->id,
            'operacion' => 'Actualizar menús de rol',
            'tabla' => 'role_menus',
            'dato' => [
                'rol' => $role->name,
                'menus_antes' => $menusAntes,
                'menus_despues' => $menusDespues,
                'menus_agregados' => $menusAgregados,
                'menus_quitados' => $menusQuitados,
            ],
        ]);

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