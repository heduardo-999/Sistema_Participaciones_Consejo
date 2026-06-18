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

/*
|--------------------------------------------------------------------------
| Rutas públicas
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);

/*
|--------------------------------------------------------------------------
| Rutas QR públicas
|--------------------------------------------------------------------------
*/

Route::post('/qr/validar', [QrAccessController::class, 'validar']);
Route::post('/qr/interaccion', [QrAccessController::class, 'interaccion']);

/*
|--------------------------------------------------------------------------
| Rutas protegidas
|--------------------------------------------------------------------------
*/

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

    Route::get('/me/menu', [MenuController::class, 'myMenu']);

    /*
    |--------------------------------------------------------------------------
    | Administración de menús por rol
    |--------------------------------------------------------------------------
    */

    Route::get('/menus-admin', [MenuRolController::class, 'menus']);
    Route::post('/menus-admin', [MenuRolController::class, 'storeMenu']);
    Route::put('/menus-admin/{id}', [MenuRolController::class, 'updateMenu']);
    Route::delete('/menus-admin/{id}', [MenuRolController::class, 'destroyMenu']);

    Route::get('/roles/{id}/menus', [MenuRolController::class, 'menusPorRol']);
    Route::post('/roles/{id}/menus', [MenuRolController::class, 'syncMenus']);

    /*
    |--------------------------------------------------------------------------
    | Administración de roles y permisos
    |--------------------------------------------------------------------------
    */

    Route::get('/roles-admin', [RolPermisoController::class, 'roles']);
    Route::post('/roles-admin', [RolPermisoController::class, 'storeRole']);

    Route::get('/permissions-admin', [RolPermisoController::class, 'permissions']);
    Route::post('/permissions-admin', [RolPermisoController::class, 'storePermission']);

    Route::get('/roles/{id}/permissions', [RolPermisoController::class, 'permissionsPorRol']);
    Route::post('/roles/{id}/permissions', [RolPermisoController::class, 'syncPermissions']);

    /*
    |--------------------------------------------------------------------------
    | Lugares
    |--------------------------------------------------------------------------
    */

    Route::get('/lugares/resumen', [LugarController::class, 'resumen']);
    Route::get('/lugares/mapa', [LugarController::class, 'mapa']);

    Route::put('/lugares-asignados/{id}/ausente', [LugarAsignadoController::class, 'marcarAusente']);
    Route::put('/lugares-asignados/{id}/liberar', [LugarAsignadoController::class, 'liberar']);
    Route::put('/lugares-asignados/{id}/reiniciar-temporizador', [LugarAsignadoController::class, 'reiniciarTemporizador']);

    /*
    |--------------------------------------------------------------------------
    | QR protegido
    |--------------------------------------------------------------------------
    */

    Route::post('/qr/generar', [QrAccessController::class, 'generar']);

    /*
    |--------------------------------------------------------------------------
    | Miembros
    |--------------------------------------------------------------------------
    */

    Route::put('/miembros/{id}/reactivar', [MiembroController::class, 'reactivar']);

    /*
    |--------------------------------------------------------------------------
    | Recursos principales
    |--------------------------------------------------------------------------
    */

    Route::apiResource('miembros', MiembroController::class);
    Route::apiResource('invitados', InvitadoController::class);
    Route::get('/reuniones-activa', [ReunionController::class, 'activa']);
    Route::post('/reuniones/{id}/iniciar', [ReunionController::class, 'iniciar']);
    Route::post('/reuniones/{id}/terminar', [ReunionController::class, 'terminar']);
    Route::apiResource('reuniones', ReunionController::class);
    Route::apiResource('participantes', ParticipanteController::class);
    Route::apiResource('intervenciones', IntervencionController::class);
    Route::apiResource('historial', HistorialController::class);
    Route::apiResource('users', UserController::class);
    Route::apiResource('lugares', LugarController::class);
    Route::apiResource('lugares-asignados', LugarAsignadoController::class);
});