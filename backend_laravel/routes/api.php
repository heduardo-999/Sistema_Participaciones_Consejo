<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MiembroController;
use App\Http\Controllers\Api\InvitadoController;
use App\Http\Controllers\Api\ReunionController;
use App\Http\Controllers\Api\ParticipanteController;
use App\Http\Controllers\Api\IntervencionController;
use App\Http\Controllers\Api\HistorialController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\LugarController;
use App\Http\Controllers\Api\LugarAsignadoController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\QrAccessController;
use App\Http\Controllers\Api\DashboardController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'CheckBaja'])->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/me', function (Request $request) {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'menus' => app(MenuController::class)->myMenu($request)->getData(),
        ]);
    });

    Route::get('/dashboard', [DashboardController::class, 'index']);

    Route::get('/me/menu', [MenuController::class, 'myMenu']);

    Route::get('/lugares/resumen', [LugarController::class, 'resumen']);
    Route::get('/lugares/mapa', [LugarController::class, 'mapa']);

    Route::put('/lugares-asignados/{id}/ausente', [LugarAsignadoController::class, 'marcarAusente']);
    Route::put('/lugares-asignados/{id}/liberar', [LugarAsignadoController::class, 'liberar']);
    Route::put('/lugares-asignados/{id}/reiniciar-temporizador', [LugarAsignadoController::class, 'reiniciarTemporizador']);

    Route::post('/qr/generar', [QrAccessController::class, 'generar']);
    Route::post('/qr/validar', [QrAccessController::class, 'validar']);
    Route::post('/qr/interaccion', [QrAccessController::class, 'interaccion']);

    Route::apiResource('miembros', MiembroController::class);
    Route::apiResource('invitados', InvitadoController::class);
    Route::apiResource('reuniones', ReunionController::class);
    Route::apiResource('participantes', ParticipanteController::class);
    Route::apiResource('intervenciones', IntervencionController::class);
    Route::apiResource('historial', HistorialController::class);
    Route::apiResource('users', UserController::class);
    Route::apiResource('lugares', LugarController::class);
    Route::apiResource('lugares-asignados', LugarAsignadoController::class);
});