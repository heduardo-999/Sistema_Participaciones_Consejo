# Docker - Sistema Participaciones Consejo

Coloca estos archivos en la raíz del proyecto:

```txt
Sistema_Participaciones_Consejo/
├── backend_laravel/
├── frontend_angular/
├── socket_server/
├── deploy/
├── docker-compose.yml
├── .dockerignore
└── .env.docker.example
```

## 1. Crear archivo de variables

Copia el ejemplo:

```bash
copy .env.docker.example .env.docker
```

En PowerShell también puedes usar:

```powershell
Copy-Item .env.docker.example .env.docker
```

## 2. Levantar contenedores

```bash
docker compose up -d --build
```

Servicios:

```txt
Frontend Angular: http://localhost:4200
Backend Laravel:  http://localhost:8000
Socket.IO:        http://localhost:3001
phpMyAdmin:       http://localhost:8080
MariaDB local:    localhost:3307
MQTT Mosquitto:   localhost:1883
```

## 3. Generar APP_KEY de Laravel

```bash
docker compose exec backend php artisan key:generate
```

Si quieres que quede guardada en `.env.docker`, copia el valor generado y colócalo en `APP_KEY=`.

## 4. Migraciones y seeders

```bash
docker compose exec backend php artisan migrate
```

Si necesitas seeders:

```bash
docker compose exec backend php artisan db:seed --class=RolesAndPermissionsSeeder
docker compose exec backend php artisan db:seed --class=RoleMenuSeeder
```

## 5. Limpiar caché

```bash
docker compose exec backend php artisan optimize:clear
```

## 6. Ver logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f socket
```

## 7. Apagar

```bash
docker compose down
```

Para borrar también la base de datos:

```bash
docker compose down -v
```

## Nota importante

Este setup es para desarrollo local y pruebas. Para producción habría que compilar Angular, servirlo con Nginx y ajustar certificados/variables reales.
