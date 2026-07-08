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
use App\Http\Controllers\Api\MenuRolController;
use App\Http\Controllers\Api\RolPermisoController;
use App\Http\Controllers\Api\TemaReunionController;
use App\Http\Controllers\Api\VotacionController;

Route::post('/login', [AuthController::class, 'login']);

Route::post('/qr/validar', [QrAccessController::class, 'validar']);
Route::post('/qr/interaccion', [QrAccessController::class, 'interaccion']);
Route::post('/qr/votacion/activa', [VotacionController::class, 'activaQr']);
Route::post('/qr/votacion/votar', [VotacionController::class, 'votarQr']);

Route::middleware(['auth:sanctum', 'CheckBaja'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/me', function (Request $request) {
        $user = $request->user();

        $menusResponse = app(MenuController::class)->myMenu($request)->getData();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'menus' => $menusResponse->data ?? [],
        ]);
    });

    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/intervenciones', [IntervencionController::class, 'dashboardIntervenciones']);
    Route::get('/dashboard/historial-intervenciones', [IntervencionController::class, 'dashboardHistorial']);

    Route::get('/votaciones/activa', [VotacionController::class, 'activa']);
    Route::post('/votaciones/iniciar', [VotacionController::class, 'iniciar']);
    Route::post('/votaciones/{id}/terminar', [VotacionController::class, 'terminar']);
    Route::post('/votaciones/{id}/guardar', [VotacionController::class, 'guardar']);
    Route::get('/votaciones/{id}/resultados', [VotacionController::class, 'resultados']);
    Route::get('/me/menu', [MenuController::class, 'myMenu']);

    Route::get('/menus-admin', [MenuRolController::class, 'menus']);
    Route::post('/menus-admin', [MenuRolController::class, 'storeMenu']);
    Route::put('/menus-admin/{id}', [MenuRolController::class, 'updateMenu']);
    Route::delete('/menus-admin/{id}', [MenuRolController::class, 'destroyMenu']);

    Route::get('/roles/{id}/menus', [MenuRolController::class, 'menusPorRol']);
    Route::post('/roles/{id}/menus', [MenuRolController::class, 'syncMenus']);

    Route::get('/roles-admin', [RolPermisoController::class, 'roles']);
    Route::post('/roles-admin', [RolPermisoController::class, 'storeRole']);
    Route::delete('/roles-admin/{id}', [RolPermisoController::class, 'destroyRole']);

    Route::get('/permissions-admin', [RolPermisoController::class, 'permissions']);
    Route::post('/permissions-admin', [RolPermisoController::class, 'storePermission']);
    Route::delete('/permissions-admin/{id}', [RolPermisoController::class, 'destroyPermission']);

    Route::get('/roles/{id}/permissions', [RolPermisoController::class, 'permissionsPorRol']);
    Route::post('/roles/{id}/permissions', [RolPermisoController::class, 'syncPermissions']);

    Route::get('/lugares/resumen', [LugarController::class, 'resumen']);
    Route::get('/lugares/mapa', [LugarController::class, 'mapa']);

    Route::put('/lugares-asignados/{id}/ausente', [LugarAsignadoController::class, 'marcarAusente']);
    Route::put('/lugares-asignados/{id}/liberar', [LugarAsignadoController::class, 'liberar']);
    Route::put('/lugares-asignados/{id}/reiniciar-temporizador', [LugarAsignadoController::class, 'reiniciarTemporizador']);

    Route::post('/qr/generar', [QrAccessController::class, 'generar']);

    Route::put('/miembros/{id}/reactivar', [MiembroController::class, 'reactivar']);

    Route::apiResource('miembros', MiembroController::class);
    Route::apiResource('invitados', InvitadoController::class);

    Route::get('/reuniones-activa', [ReunionController::class, 'activa']);
    Route::post('/reuniones/{id}/iniciar', [ReunionController::class, 'iniciar']);
    Route::post('/reuniones/{id}/terminar', [ReunionController::class, 'terminar']);
    Route::post('/reuniones/{id}/participantes/agregar-miembros', [ParticipanteController::class, 'agregarTodosMiembros']);
    Route::get('/reuniones/{id}/votaciones', [VotacionController::class, 'porReunion']);
    Route::apiResource('reuniones', ReunionController::class);

    Route::apiResource('participantes', ParticipanteController::class);
    Route::apiResource('intervenciones', IntervencionController::class);
    Route::apiResource('historial', HistorialController::class);
    Route::get('/users/roles', [UserController::class, 'roles']);
    Route::apiResource('users', UserController::class);
    Route::apiResource('lugares', LugarController::class);
    Route::apiResource('lugares-asignados', LugarAsignadoController::class);

    Route::get('/temas-reunion', [TemaReunionController::class, 'index']);
    Route::post('/temas-reunion', [TemaReunionController::class, 'store']);
    Route::get('/temas-reunion/{id}', [TemaReunionController::class, 'show']);
    Route::put('/temas-reunion/{id}', [TemaReunionController::class, 'update']);
    Route::delete('/temas-reunion/{id}', [TemaReunionController::class, 'destroy']);

    Route::get('/reuniones/{id}/tema-actual', [TemaReunionController::class, 'actual']);
    Route::post('/temas-reunion/{id}/completar', [TemaReunionController::class, 'completar']);
    Route::post('/reuniones/{id}/temas/reiniciar', [TemaReunionController::class, 'reiniciarTemas']);

    Route::post('/reuniones/{id}/toggle-pausa-intervenciones', [ReunionController::class, 'togglePausaIntervenciones']);
    Route::post('/reuniones/{id}/toggle-intervenciones-automaticas', [ReunionController::class, 'toggleIntervencionesAutomaticas']);
});