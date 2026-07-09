<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ConfiguracionTiemposController extends Controller
{
    private array $defaults = [
        'tiempo_espera_entre_intervenciones_seg' => 10,
        'tiempo_preparacion_intervencion_seg' => 10,
        'tiempo_intervencion_seg' => 300,
        'tiempo_visualizacion_votacion_seg' => 7,
        'tiempo_maximo_votacion_activa_seg' => 120,
    ];

    public function index()
    {
        return response()->json($this->leerConfiguracion());
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'tiempo_espera_entre_intervenciones_seg' => ['required', 'integer', 'min:0', 'max:300'],
            'tiempo_preparacion_intervencion_seg' => ['required', 'integer', 'min:1', 'max:120'],
            'tiempo_intervencion_seg' => ['required', 'integer', 'min:30', 'max:7200'],
            'tiempo_visualizacion_votacion_seg' => ['required', 'integer', 'min:1', 'max:120'],
            'tiempo_maximo_votacion_activa_seg' => ['required', 'integer', 'min:10', 'max:3600'],
        ], [
            'tiempo_espera_entre_intervenciones_seg.required' => 'El tiempo de espera entre intervenciones es obligatorio.',
            'tiempo_preparacion_intervencion_seg.required' => 'El tiempo para prepararse es obligatorio.',
            'tiempo_intervencion_seg.required' => 'El tiempo asignado por intervención es obligatorio.',
            'tiempo_visualizacion_votacion_seg.required' => 'El tiempo de visualización de votación es obligatorio.',
            'tiempo_maximo_votacion_activa_seg.required' => 'La duración máxima de votación activa es obligatoria.',
            '*.integer' => 'El valor debe ser un número entero.',
        ]);

        if (!Schema::hasTable('configuraciones_tiempos')) {
            return response()->json($data);
        }

        foreach ($data as $key => $value) {
            DB::table('configuraciones_tiempos')->updateOrInsert(
                ['clave' => $key],
                ['valor' => (string) $value, 'updated_at' => now(), 'created_at' => now()]
            );
        }

        return response()->json($this->leerConfiguracion());
    }

    private function leerConfiguracion(): array
    {
        $valores = $this->defaults;

        if (Schema::hasTable('configuraciones_tiempos')) {
            $guardados = DB::table('configuraciones_tiempos')
                ->whereIn('clave', array_keys($this->defaults))
                ->pluck('valor', 'clave')
                ->toArray();

            foreach ($guardados as $clave => $valor) {
                $valores[$clave] = (int) $valor;
            }
        }

        return $valores;
    }
}
