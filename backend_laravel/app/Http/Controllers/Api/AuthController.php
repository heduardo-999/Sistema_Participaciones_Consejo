<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Historial;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales incorrectas'
            ], 401);
        }

        $user = User::where('email', $request->email)->first();

        $token = $user->createToken('api-token')->plainTextToken;

        Historial::create([
            'user_id' => $user->id,
            'operacion' => 'Inicio de sesión',
            'tabla' => 'users',
            'dato' => [
                'email' => $user->email,
                'fecha' => now(),
            ],
        ]);

        return response()->json([
            'success' => true,
            'user' => $user,
            'token' => $token
        ]);
    }

    public function logout(Request $request)
    {
        Historial::create([
            'user_id' => $request->user()->id,
            'operacion' => 'Cierre de sesión',
            'tabla' => 'users',
            'dato' => [
                'email' => $request->user()->email,
                'fecha' => now(),
            ],
        ]);

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada'
        ]);
    }
}