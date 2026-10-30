# Base de datos — Sistema de Gestión de Condominio

Cada desarrollador usa su propia instancia Oracle. Las credenciales se configuran
solo en `backend/.env`, creado desde [`backend/.env.example`](../backend/.env.example);
ese archivo real está excluido de Git.

## Iniciar Oracle

1. Instala Docker Desktop.
2. Desde la raíz del repositorio, copia `backend/.env.example` a `backend/.env` y
   reemplaza las contraseñas de ejemplo por valores locales.
3. Inicia Oracle desde `backend/`:
   ```bash
   docker compose up -d oracle
   docker compose logs -f oracle
   ```
4. Espera a que aparezca `DATABASE IS READY TO USE!`.

El Compose monta `database/ddl/` y Oracle ejecuta esos scripts en orden al crear un
volumen nuevo. Después ejecuta los scripts de `database/seeds/` una vez con SQLcl o
DBeaver para cargar roles y datos de prueba. Si usas un volumen existente, las
migraciones no se vuelven a ejecutar automáticamente: aplica cada archivo numerado
pendiente una vez.

La conexión del backend usa `DB_USER`, `DB_PASSWORD` y `DB_CONNECTION_STRING`. El
valor de ejemplo apunta al service name `FREEPDB1`; si cambias `ORACLE_PORT`, actualiza
también el puerto de `DB_CONNECTION_STRING`.

## Comandos útiles

Desde `backend/`:

```bash
docker compose stop oracle
docker compose start oracle
docker compose down
```

`docker compose down -v` también elimina el volumen con los datos locales de Oracle.
Úsalo solo cuando quieras borrar la base completa.

## Solución de problemas

- **Docker no responde**: inicia Docker Desktop y espera a que esté listo.
- **Puerto ocupado**: cambia `ORACLE_PORT` en `backend/.env` y actualiza el puerto
  dentro de `DB_CONNECTION_STRING`.
- **El backend no conecta**: comprueba que Oracle haya terminado de iniciar y que
  `DB_USER`, `DB_PASSWORD` y `DB_CONNECTION_STRING` coincidan con el Compose.

## Reglas del equipo

- No se suben bases de datos completas ni exports de datos reales; solo DDL y seeds.
- Si cambia una tabla, actualiza su DDL/migración en el mismo commit.
- No subas archivos `.env` reales ni credenciales al repositorio.
