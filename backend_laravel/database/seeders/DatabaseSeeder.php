<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            AdminUserSeeder::class,

            // Menús del sistema y asignación por rol
            MenuSeeder::class,
            RoleMenuSeeder::class,

            // Datos de prueba
            MiembroSeeder::class,
            InvitadoSeeder::class,
            ReunionSeeder::class,
            ParticipanteSeeder::class,
            IntervencionSeeder::class,
            HistorialSeeder::class,
            LugarSeeder::class,
        ]);
    }
}
