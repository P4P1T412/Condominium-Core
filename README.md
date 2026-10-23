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

### 2. Base de datos (Oracle con Docker)

Cada desarrollador corre **su propia instancia local** de Oracle — no se comparte una
sola base para el desarrollo diario.

1. Instala [Docker Desktop](https://www.docker.com/) y déjalo abierto.
2. Levanta el contenedor:
   ```bash
   docker run -d --name condominio-oracle -p 1521:1521 -e ORACLE_PASSWORD=TuPasswordSegura123 -e APP_USER=condominio_app -e APP_USER_PASSWORD=TuPasswordSegura123 gvenzl/oracle-free:23-slim
   ```
3. Espera a que inicialice (`docker logs -f condominio-oracle` hasta ver `DATABASE IS READY TO USE!`).
4. Ejecuta los scripts de `database/ddl/`, `database/seeds/` y `database/views/` con
   DBeaver u otro cliente SQL, conectando a `localhost:1521`, service name `FREEPDB1`.

Instrucciones completas, comandos del contenedor y solución de problemas en
[`database/README.md`](./database/README.md).

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
```
Edita tu `.env` con los datos del contenedor que acabas de levantar:
```env
DB_USER=condominio_app
DB_PASSWORD=TuPasswordSegura123
DB_CONNECT_STRING=localhost:1521/FREEPDB1
JWT_SECRET=cambia_este_valor_por_uno_seguro
```
Luego levanta el servidor:
```bash
npm run dev   # http://localhost:4000
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env      # apunta VITE_API_URL a tu backend local
npm run dev                # http://localhost:5173
```

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
