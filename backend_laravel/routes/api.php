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

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::apiResource('miembros', MiembroController::class);
    Route::apiResource('invitados', InvitadoController::class);
    Route::apiResource('reuniones', ReunionController::class);
    Route::apiResource('participantes', ParticipanteController::class);
    Route::apiResource('intervenciones', IntervencionController::class);
    Route::apiResource('historial', HistorialController::class);
});