<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckBaja
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && $request->user()->baja == 1) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario dado de baja. No puede acceder al sistema.'
            ], 403);
        }

        return $next($request);
    }
}
