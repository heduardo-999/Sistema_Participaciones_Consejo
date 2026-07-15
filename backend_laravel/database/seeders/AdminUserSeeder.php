<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = User::updateOrCreate(
            ['email' => 'admin@sistema.com'],
            [
                'name' => 'Administrador',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $superAdmin->syncRoles(['super admin']);

        $admin = User::updateOrCreate(
            ['email' => 'admin2@sistema.com'],
            [
                'name' => 'Admin General',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $admin->syncRoles(['admin']);

        $moderador = User::updateOrCreate(
            ['email' => 'moderador@sistema.com'],
            [
                'name' => 'Moderador General',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $moderador->syncRoles(['moderador']);

        $visualizador = User::updateOrCreate(
            ['email' => 'visualizador@sistema.com'],
            [
                'name' => 'Visualizador General',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $visualizador->syncRoles(['visualizador']);
    }
}
