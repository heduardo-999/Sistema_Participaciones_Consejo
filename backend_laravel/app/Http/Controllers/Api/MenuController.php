<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function myMenu(Request $request)
    {
        $user = $request->user();

        $roleIds = $user->roles()->pluck('roles.id')->toArray();

        $menus = Menu::query()
            ->join('role_menus', 'menus.id', '=', 'role_menus.menu_id')
            ->whereIn('role_menus.role_id', $roleIds)
            ->where('menus.baja', 0)
            ->select('menus.*')
            ->distinct()
            ->orderBy('menus.id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $menus
        ]);
    }
}