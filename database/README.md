# Base de datos — Sistema de Gestión de Condominio

Cada desarrollador corre **su propia instancia local** de Oracle — no se comparte una
sola base para el desarrollo diario. Para esto se recomienda usar Docker junto con
DBeaver (u otro cliente SQL de tu preferencia).

## Cómo levantar tu base local

1. Instala [Docker Desktop](https://www.docker.com/) y déjalo abierto.
2. Levanta el contenedor de Oracle (usamos `gvenzl/oracle-free`, una imagen ligera que
   no requiere cuenta de Oracle):
   ```bash
   docker run -d --name condominio-oracle -p 1521:1521 -e ORACLE_PASSWORD=TuPasswordSegura123 -e APP_USER=condominio_app -e APP_USER_PASSWORD=TuPasswordSegura123 gvenzl/oracle-free:23-slim
   ```
   > En Windows/PowerShell, pega el comando completo en una sola línea (no lo dividas
   > con `\`, esa sintaxis es de bash/Linux, no de PowerShell).
3. Espera a que termine de inicializar (la primera vez tarda unos minutos):
   ```bash
   docker logs -f condominio-oracle
   ```
   Cuando veas `DATABASE IS READY TO USE!`, ya puedes continuar.
4. Conéctate con DBeaver (o tu cliente SQL preferido):
   - Host: `localhost`
   - Puerto: `1521`
   - Base de datos / Service name: `FREEPDB1`
   - Usuario: `condominio_app`
   - Contraseña: la que pusiste en `APP_USER_PASSWORD`
5. Ejecuta los scripts de `ddl/` **en orden numérico** (01, 02, 03...), ya que las
   tablas posteriores dependen de las anteriores por sus llaves foráneas. Luego corre
   los de `seeds/` para los roles base, y los de `views/` si tu módulo los necesita.

## Comandos útiles del contenedor

```bash
docker stop condominio-oracle     # apagarlo
docker start condominio-oracle    # volver a encenderlo
docker rm -f condominio-oracle    # borrarlo por completo (para empezar de cero)
```

## Solución de problemas comunes

- **`Conflict. The container name "/condominio-oracle" is already in use`**: ya existe
  un contenedor con ese nombre (por ejemplo, de un intento anterior que falló). Bórralo
  con `docker rm -f condominio-oracle` y vuelve a correr el `docker run` del paso 2.
- **`Cannot connect to the Docker daemon`**: Docker Desktop no está abierto. Ábrelo y
  espera a que termine de iniciar antes de correr el comando.
- **`port is already allocated`**: algo más en tu computadora está usando el puerto
  1521. Cierra ese programa o cambia el puerto publicado (por ejemplo `-p 1522:1521`),
  y ajusta `DB_CONNECT_STRING` en tu `.env` acorde.

## Reglas del equipo

- No se sube ninguna base de datos completa ni exports de datos reales al repositorio
  — solo estructura (DDL) y datos de prueba (seeds).
- Cada desarrollador reconstruye su base local desde estos scripts; no se depende de
  una sola base compartida para el desarrollo diario.
- Si cambias una tabla, actualiza el script correspondiente en `ddl/` en el mismo
  commit — no lo dejes solo en tu base local.
- Las credenciales de conexión van en el `.env` de `backend/` (nunca en estos scripts
  ni en el repositorio).
