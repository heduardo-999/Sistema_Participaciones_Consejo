<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SocketService
{
    public static function emit(string $event, array $payload = []): void
    {
        try {
            Http::timeout(2)
                ->withHeaders([
                    'x-socket-secret' => config('services.socket.secret'),
                ])
                ->post(config('services.socket.url') . '/emit', [
                    'event' => $event,
                    'payload' => $payload,
                ]);
        } catch (\Throwable $e) {
            Log::warning('No se pudo emitir evento Socket.IO', [
                'event' => $event,
                'error' => $e->getMessage(),
            ]);
        }
    }
}   