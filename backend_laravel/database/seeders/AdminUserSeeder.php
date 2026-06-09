<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $superAdmin = User::firstOrCreate(
            ['email' => 'admin@sistema.com'],
            [
                'name' => 'Administrador',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $superAdmin->syncRoles(['super admin']);

        $admin = User::firstOrCreate(
            ['email' => 'admin2@sistema.com'],
            [
                'name' => 'Admin General',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $admin->syncRoles(['admin']);

        $moderador = User::firstOrCreate(
            ['email' => 'moderador@sistema.com'],
            [
                'name' => 'Moderador General',
                'password' => Hash::make('12345678'),
                'baja' => 0,
            ]
        );

        $moderador->syncRoles(['moderador']);
    }
}