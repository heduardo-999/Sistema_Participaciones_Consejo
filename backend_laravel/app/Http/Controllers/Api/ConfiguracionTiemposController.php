<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfiguracionTiemposController extends Controller
{
    private array $defaults = [
        'tiempo_espera_entre_intervenciones_seg' => 10,
        'tiempo_preparacion_intervencion_seg' => 10,
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
            'tiempo_visualizacion_votacion_seg' => ['required', 'integer', 'min:1', 'max:120'],
            'tiempo_maximo_votacion_activa_seg' => ['required', 'integer', 'min:10', 'max:3600'],
        ], [
            'tiempo_espera_entre_intervenciones_seg.required' => 'El tiempo de espera entre intervenciones es obligatorio.',
            'tiempo_espera_entre_intervenciones_seg.integer' => 'El tiempo de espera debe ser un número entero.',
            'tiempo_espera_entre_intervenciones_seg.min' => 'El tiempo de espera no puede ser menor a 0 segundos.',
            'tiempo_espera_entre_intervenciones_seg.max' => 'El tiempo de espera no puede ser mayor a 300 segundos.',
            'tiempo_preparacion_intervencion_seg.required' => 'El tiempo de preparación es obligatorio.',
            'tiempo_preparacion_intervencion_seg.integer' => 'El tiempo de preparación debe ser un número entero.',
            'tiempo_preparacion_intervencion_seg.min' => 'El tiempo de preparación debe ser al menos de 1 segundo.',
            'tiempo_preparacion_intervencion_seg.max' => 'El tiempo de preparación no puede ser mayor a 120 segundos.',
            'tiempo_visualizacion_votacion_seg.required' => 'El tiempo de visualización de votación es obligatorio.',
            'tiempo_visualizacion_votacion_seg.integer' => 'El tiempo de visualización debe ser un número entero.',
            'tiempo_visualizacion_votacion_seg.min' => 'El tiempo de visualización debe ser al menos de 1 segundo.',
            'tiempo_visualizacion_votacion_seg.max' => 'El tiempo de visualización no puede ser mayor a 120 segundos.',
            'tiempo_maximo_votacion_activa_seg.required' => 'La duración máxima de la votación es obligatoria.',
            'tiempo_maximo_votacion_activa_seg.integer' => 'La duración máxima de la votación debe ser un número entero.',
            'tiempo_maximo_votacion_activa_seg.min' => 'La duración máxima de la votación debe ser al menos de 10 segundos.',
            'tiempo_maximo_votacion_activa_seg.max' => 'La duración máxima de la votación no puede ser mayor a 3600 segundos.',
        ]);

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

        if (DB::getSchemaBuilder()->hasTable('configuraciones_tiempos')) {
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
