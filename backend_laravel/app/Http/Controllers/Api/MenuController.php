<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Menu;
use App\Models\User;

class MenuController extends Controller
{
    public function myMenu()
    {
        $user = User::mySelf();

        $menus = collect();

        if ($user->hasRole('super admin')) {

            $menus = Menu::where('baja', 0)->get();

        } elseif ($user->hasRole('admin')) {

            $menus = Menu::where('baja', 0)
                ->whereNotIn('nombre', [])
                ->get();

        } elseif ($user->hasRole('moderador')) {

            $menus = Menu::where('baja', 0)
                ->whereNotIn('nombre', [
                    'Usuarios'
                ])
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $menus
        ]);
    }
}