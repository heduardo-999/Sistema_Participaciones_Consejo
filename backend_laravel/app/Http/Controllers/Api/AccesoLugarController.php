<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Historial;
use App\Models\Invitado;
use App\Models\Lugar;
use App\Models\LugarAsignado;
use App\Models\Miembro;
use App\Models\Participante;
use App\Models\Reunion;
use App\Models\TokenQr;
use App\Models\User;
use App\Services\SocketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AccesoLugarController extends Controller
{
    public function infoLugar(int $lugarId)
    {
        $lugar = Lugar::where('baja', 0)->find($lugarId);

        if (!$lugar) {
            return response()->json([
                'success' => false,
                'message' => 'Lugar no encontrado'
            ], 404);
        }

        if ($lugarId < 1 || $lugarId > 26) {
            return response()->json([
                'success' => false,
                'message' => 'Este acceso solo aplica para lugares individuales del 1 al 26. Usa el QR de rezagados para lugares 27 al 40.'
            ], 422);
        }

        $reunion = $this->reunionActiva();

        return response()->json([
            'success' => true,
            'data' => [
                'tipo_acceso' => 'lugar',
                'lugar' => $this->lugarData($lugar),
                'reunion' => $this->reunionData($reunion),
                'disponible' => $this->lugarDisponible($lugar),
                'message' => $reunion ? 'Acceso listo.' : 'No hay reunión activa en este momento.',
            ]
        ]);
    }

    public function infoRezagados()
    {
        $reunion = $this->reunionActiva();
        $lugar = $this->primerLugarRezagadoDisponible();

        return response()->json([
            'success' => true,
            'data' => [
                'tipo_acceso' => 'rezagados',
                'rango' => '27-40',
                'lugar' => $lugar ? $this->lugarData($lugar) : null,
                'reunion' => $this->reunionData($reunion),
                'disponible' => (bool) $lugar,
                'message' => $reunion ? 'El sistema asignará automáticamente el primer lugar libre entre 27 y 40.' : 'No hay reunión activa en este momento.',
            ]
        ]);
    }

    public function registrarMiembroLugar(Request $request, int $lugarId)
    {
        $validated = $request->validate([
            'codigo' => 'required|string|min:4|max:20',
        ]);

        return $this->registrarMiembro($validated['codigo'], $lugarId, false);
    }

    public function registrarInvitadoLugar(Request $request, int $lugarId)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:150',
        ]);

        return $this->registrarInvitado($validated['nombre'], $lugarId, false);
    }

    public function registrarMiembroRezagado(Request $request)
    {
        $validated = $request->validate([
            'codigo' => 'required|string|min:4|max:20',
        ]);

        return $this->registrarMiembro($validated['codigo'], null, true);
    }

    public function registrarInvitadoRezagado(Request $request)
    {
        $validated = $request->validate([
            'nombre' => 'required|string|max:150',
        ]);

        return $this->registrarInvitado($validated['nombre'], null, true);
    }

    private function registrarMiembro(string $codigo, ?int $lugarId, bool $rezagado)
    {
        $codigo = trim($codigo);

        $miembro = Miembro::where('rfid', $codigo)
            ->where(function ($query) {
                $query->where('baja', 0)->orWhereNull('baja');
            })
            ->first();

        if (!$miembro) {
            return response()->json([
                'success' => false,
                'message' => 'No encontramos un miembro activo con ese código.'
            ], 404);
        }

        return $this->registrarParticipante($miembro, null, $lugarId, $rezagado);
    }

    private function registrarInvitado(string $nombre, ?int $lugarId, bool $rezagado)
    {
        $nombre = trim(preg_replace('/\s+/', ' ', $nombre));

        if (mb_strlen($nombre) < 3) {
            return response()->json([
                'success' => false,
                'message' => 'Escribe el nombre completo del invitado.'
            ], 422);
        }

        $invitado = Invitado::create([
            'nombre' => $nombre,
            'fecha_participacion' => now()->toDateString(),
        ]);

        return $this->registrarParticipante(null, $invitado, $lugarId, $rezagado);
    }

    private function registrarParticipante(?Miembro $miembro, ?Invitado $invitado, ?int $lugarId, bool $rezagado)
    {
        $reunion = $this->reunionActiva();

        if (!$reunion) {
            return response()->json([
                'success' => false,
                'message' => 'No hay reunión activa en este momento.'
            ], 422);
        }

        try {
            $resultado = DB::transaction(function () use ($miembro, $invitado, $lugarId, $rezagado, $reunion) {
                $participante = $this->obtenerOCrearParticipante($reunion, $miembro, $invitado);

                $asignacionExistente = LugarAsignado::with('lugar')
                    ->where('participante_id', $participante->id)
                    ->first();

                if ($asignacionExistente) {
                    $tokenQr = $this->obtenerOCrearToken($participante);

                    return [
                        'participante' => $participante->load(['miembro', 'invitado', 'reunion']),
                        'lugar' => $asignacionExistente->lugar,
                        'asignacion' => $asignacionExistente,
                        'token' => $tokenQr,
                        'ya_asignado' => true,
                    ];
                }

                $lugar = $rezagado
                    ? $this->primerLugarRezagadoDisponible(true)
                    : $this->lugarIndividualDisponible($lugarId, true);

                if (!$lugar) {
                    abort(response()->json([
                        'success' => false,
                        'message' => $rezagado
                            ? 'No hay lugares rezagados disponibles entre el 27 y el 40.'
                            : 'Este lugar no está disponible.'
                    ], 422));
                }

                $asignacion = LugarAsignado::create([
                    'lugar_id' => $lugar->id,
                    'participante_id' => $participante->id,
                ]);

                if ($participante->status !== 'presente') {
                    $participante->update(['status' => 'presente']);
                }

                $tokenQr = $this->obtenerOCrearToken($participante->fresh(['miembro', 'invitado', 'reunion']));

                Historial::create([
                    'user_id' => $this->usuarioHistorial(),
                    'operacion' => $rezagado ? 'Asignación automática por QR rezagados' : 'Asignación automática por QR estático de lugar',
                    'tabla' => 'lugares_asignados',
                    'dato' => [
                        'lugar_id' => $lugar->id,
                        'participante_id' => $participante->id,
                        'participante' => $this->nombreParticipante($participante->fresh(['miembro', 'invitado'])),
                        'reunion_id' => $reunion->id,
                        'reunion' => $reunion->sesion,
                        'tipo_acceso' => $rezagado ? 'rezagados' : 'lugar_individual',
                    ],
                ]);

                SocketService::emit('lugares:updated', [
                    'accion' => 'asignacion_qr_estatico',
                    'lugar_id' => $lugar->id,
                    'participante_id' => $participante->id,
                    'reunion_id' => $reunion->id,
                ]);

                SocketService::emit('participantes:updated', [
                    'accion' => 'alta_qr_estatico',
                    'participante_id' => $participante->id,
                    'reunion_id' => $reunion->id,
                ]);

                SocketService::emit('dashboard:updated', [
                    'accion' => 'alta_qr_estatico',
                    'lugar_id' => $lugar->id,
                    'participante_id' => $participante->id,
                ]);

                return [
                    'participante' => $participante->fresh(['miembro', 'invitado', 'reunion']),
                    'lugar' => $lugar,
                    'asignacion' => $asignacion,
                    'token' => $tokenQr,
                    'ya_asignado' => false,
                ];
            });
        } catch (\Throwable $error) {
            if (method_exists($error, 'getResponse')) {
                return $error->getResponse();
            }

            throw $error;
        }

        return response()->json([
            'success' => true,
            'message' => $resultado['ya_asignado']
                ? 'Ya tenías un lugar asignado. Te enviaremos a tu ESP32 virtual.'
                : 'Registro correcto. Tu lugar fue asignado automáticamente.',
            'data' => [
                'participante' => [
                    'id' => $resultado['participante']->id,
                    'nombre' => $this->nombreParticipante($resultado['participante']),
                    'tipo' => $resultado['participante']->miembro_id ? 'miembro' : 'invitado',
                ],
                'lugar' => $this->lugarData($resultado['lugar']),
                'asignacion_id' => $resultado['asignacion']->id,
                'token' => $resultado['token']->token,
                'url' => $this->urlQr($resultado['token']->token),
            ]
        ]);
    }

    private function obtenerOCrearParticipante(Reunion $reunion, ?Miembro $miembro, ?Invitado $invitado): Participante
    {
        if ($miembro) {
            $participante = Participante::where('reunion_id', $reunion->id)
                ->where('miembro_id', $miembro->id)
                ->first();

            if ($participante) {
                if ($participante->status === 'retirado') {
                    $participante->update(['status' => 'presente']);
                }

                return $participante->fresh(['miembro', 'invitado', 'reunion']);
            }

            return Participante::create([
                'miembro_id' => $miembro->id,
                'invitado_id' => null,
                'reunion_id' => $reunion->id,
                'fecha' => now()->toDateString(),
                'status' => 'presente',
            ]);
        }

        return Participante::create([
            'miembro_id' => null,
            'invitado_id' => $invitado->id,
            'reunion_id' => $reunion->id,
            'fecha' => now()->toDateString(),
            'status' => 'presente',
        ]);
    }

    private function lugarIndividualDisponible(?int $lugarId, bool $lock = false): ?Lugar
    {
        if (!$lugarId || $lugarId < 1 || $lugarId > 26) {
            return null;
        }

        $query = Lugar::where('id', $lugarId)
            ->where('baja', 0)
            ->where('status', '!=', 'denegado');

        if ($lock) {
            $query->lockForUpdate();
        }

        $lugar = $query->first();

        if (!$lugar || !$this->lugarDisponible($lugar)) {
            return null;
        }

        return $lugar;
    }

    private function primerLugarRezagadoDisponible(bool $lock = false): ?Lugar
    {
        $query = Lugar::whereBetween('id', [27, 40])
            ->where('baja', 0)
            ->where('status', '!=', 'denegado')
            ->orderBy('id');

        if ($lock) {
            $query->lockForUpdate();
        }

        $lugares = $query->get();

        foreach ($lugares as $lugar) {
            if ($this->lugarDisponible($lugar)) {
                return $lugar;
            }
        }

        return null;
    }

    private function lugarDisponible(Lugar $lugar): bool
    {
        return !LugarAsignado::where('lugar_id', $lugar->id)->exists();
    }

    private function reunionActiva(): ?Reunion
    {
        return Reunion::where('status', 'activa')
            ->latest('id')
            ->first();
    }

    private function obtenerOCrearToken(Participante $participante): TokenQr
    {
        TokenQr::where('expires_at', '<=', now())
            ->where('status', 'activo')
            ->update(['status' => 'expirado']);

        $token = TokenQr::where('participante_id', $participante->id)
            ->where('status', 'activo')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if ($token) {
            return $token;
        }

        TokenQr::where('participante_id', $participante->id)
            ->where('status', 'activo')
            ->update(['status' => 'expirado']);

        return TokenQr::create([
            'participante_id' => $participante->id,
            'token' => Str::random(80),
            'expires_at' => now()->addHours(12),
            'status' => 'activo',
        ]);
    }

    private function urlQr(string $token): string
    {
        return $this->frontendBaseUrl() . '/qr/esp32/' . $token;
    }

    private function frontendBaseUrl(): string
    {
        $frontendUrl = trim((string) config('app.frontend_url', ''));

        if ($frontendUrl !== '') {
            return rtrim($frontendUrl, '/');
        }

        $scheme = request()->getScheme();
        $host = request()->getHost();
        $frontendPort = trim((string) config('app.frontend_port', ''));

        if ($frontendPort !== '') {
            return $scheme . '://' . $host . ':' . $frontendPort;
        }

        return rtrim($scheme . '://' . $host, '/');
    }

    private function lugarData(?Lugar $lugar): ?array
    {
        if (!$lugar) return null;

        return [
            'id' => $lugar->id,
            'numero' => $lugar->id,
            'mesa_id' => $lugar->mesa_id,
            'esp_id' => $lugar->esp_id,
            'status' => $lugar->status,
        ];
    }

    private function reunionData(?Reunion $reunion): ?array
    {
        if (!$reunion) return null;

        return [
            'id' => $reunion->id,
            'sesion' => $reunion->sesion,
            'fecha' => $reunion->fecha,
            'status' => $reunion->status,
            'hora_inicio' => $reunion->hora_inicio,
            'hora_fin' => $reunion->hora_fin,
        ];
    }

    private function usuarioHistorial(): ?int
    {
        $superAdmin = User::role('super admin')->first();

        if ($superAdmin) {
            return $superAdmin->id;
        }

        return User::query()->value('id');
    }

    private function nombreParticipante(Participante $participante): string
    {
        return $participante->miembro?->nombre
            ?? $participante->invitado?->nombre
            ?? 'Participante sin nombre';
    }
}
