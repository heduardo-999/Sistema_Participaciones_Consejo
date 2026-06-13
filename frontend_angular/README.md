# Frontend - Sistema de Participaciones Consejo

## Instalación
```bash
npm install -g @angular/cli@20
npm install
npm start
```

## API
Editar `src/environments/environment.ts`:
```ts
apiUrl: 'http://127.0.0.1:8000/api'
```

## Endpoints esperados
- POST /api/login
- POST /api/logout
- GET /api/me
- GET /api/dashboard
- GET /api/miembros
- GET /api/invitados
- GET /api/reuniones
- GET /api/participantes
- GET /api/intervenciones
- GET /api/lugares
- GET /api/lugares/resumen
- CRUD /api/usuarios
- CRUD /api/lugares-asignados

## Nota
El menú se toma desde `/api/me` usando el arreglo `menus`. Si la API aún no lo manda, el layout usa menús temporales para poder navegar.
