<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::firstOrCreate(
            [
                'email' => 'admin@sistema.com'
            ],
            [
                'name' => 'Administrador',
                'password' => Hash::make('12345678')
            ]
        );

        $user->assignRole('super admin');
    }
}
