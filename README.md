# Sistema de Gestión de Condominio

Aplicación web para la administración integral de un condominio: casas y familias,
pagos y cuotas de mantenimiento, notificaciones/comunicados, quejas, y control de
acceso de visitantes mediante personal de garita.

## Estructura del repositorio

```
condominio-app/
├── frontend/     # React + Vite
├── backend/      # Node.js + Express (API REST)
├── database/     # Scripts SQL (DDL, seeds, vistas) para Oracle
└── docs/         # Diagramas UML, planificación de sprints y guía de módulos del frontend
```

## Equipo y módulos

| Módulo | Carpeta (frontend y backend) | Responsable |
|---|---|---|
| Casas y usuarios (login, roles) | `modules/auth`, `modules/casas`, `modules/usuarios` | Dev 1 |
| Pagos y finanzas | `modules/pagos` | Dev 2 |
| Garita y seguridad | `modules/seguridad` | Dev 2 |
| Notificaciones y visitas | `modules/notificaciones`, `modules/visitas` | Dev 3 |
| Base de datos | `database/` | DB Dev 1 y DB Dev 2 |

> El detalle de cada módulo (pestañas internas, qué debe mostrar cada una, componentes
> compartidos a usar) está en [`docs/guia-frontend-modulos.md`](./docs/guia-frontend-modulos.md).

## Cómo levantar el proyecto por primera vez

### 1. Clonar el repositorio
```bash
git clone <url-del-repo>
cd condominio-app
```

### 2. Configurar entorno y Oracle

Cada desarrollador usa su propia base Oracle local. Copia los ejemplos y cambia los
valores de contraseña/secretos antes de iniciar:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

En PowerShell puedes usar `Copy-Item backend/.env.example backend/.env` y el comando
equivalente para `frontend`. `backend/.env` configura Oracle, JWT, CORS y servicios
opcionales; `frontend/.env` configura la URL de la API. Los archivos `.env` reales no
se versionan.

Con Docker Desktop instalado, inicia Oracle desde la carpeta `backend`:

```bash
cd backend
docker compose up -d oracle
docker compose logs -f oracle
```

Al crear una base nueva, Oracle ejecuta los scripts de `database/ddl/` en orden. Los
seeds de `database/seeds/` deben ejecutarse una vez con SQLcl/DBeaver. En un volumen
existente, los scripts de inicialización no vuelven a ejecutarse automáticamente;
aplica manualmente las migraciones numeradas pendientes. Consulta
[`database/README.md`](./database/README.md).

### 3. Backend

Desde `backend/`, instala dependencias e inicia la API:

```bash
npm install
npm run dev
```

La API escucha en el puerto definido por `PORT` (por defecto 4000).

### 4. Frontend

Desde `frontend/`, instala dependencias e inicia Vite:

```bash
npm install
npm run dev
```

Vite muestra la URL disponible (por defecto `http://localhost:5173`).

## Flujo de ramas

```
main        → versión estable
develop     → integración de todos los módulos
feature/<módulo>   → una rama por módulo/historia en desarrollo
```

Cada desarrollador trabaja en su rama `feature/<módulo>` y abre un pull request
hacia `develop`, revisado por al menos un integrante distinto al autor.

## Documentación adicional

- [`docs/guia-frontend-modulos.md`](./docs/guia-frontend-modulos.md) — detalle de cada
  módulo del frontend: pestañas internas, qué debe mostrar cada una, y los componentes
  compartidos (`Tabs`, `StatusBadge`) que todos deben usar.
- [`database/README.md`](./database/README.md) — cómo levantar tu base de datos local
  y reglas del equipo sobre la base de datos.
- [`docs/diagramas/`](./docs/diagramas/) — diagramas UML (clases, casos de uso, secuencia).

## Reglas rápidas del equipo

- Nunca subir archivos `.env` con credenciales reales (ya están en `.gitignore`).
- Nunca subir una base de datos completa ni exports de datos reales: solo scripts en `database/`.
- Cada quien trabaja dentro de la carpeta de su módulo asignado, tanto en `frontend/src/modules/` como en `backend/src/modules/`.
- Si cambias una tabla, actualiza el script correspondiente en `database/ddl/` en el mismo commit — no lo dejes solo en tu base local.
