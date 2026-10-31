-- =====================================================================
-- MIGRACIÓN 06: DESTINATARIOS DINÁMICOS Y ENVÍO POR WHATSAPP
-- Archivo: database/ddl/06_migration_comunicaciones_destinatarios.sql
-- ---------------------------------------------------------------------
-- Objetivo:
--   Actualizar una base de datos existente para soportar:
--     * tipo_destinatario: TODOS | ADMINISTRADOR | CONDOMINOS | GARITA | ESPECIFICO
--     * rol_destino e id_usuario_destino
--     * canal_envio y bandera enviar_whatsapp en QUEJA
--     * QUEJA.id_casa opcional (un administrador/garita puede no tener casa)
--
-- CÓMO EJECUTARLO EN DBEAVER:
--   * Cada sentencia es un ALTER TABLE independiente y termina en punto y coma.
--   * Coloca el cursor sobre la sentencia y presiona Ctrl+Enter para ejecutar
--     SOLO esa sentencia. Repite con la siguiente.
--   * Ejecuta el archivo de arriba hacia abajo: primero las columnas y luego
--     las restricciones.
--
-- IMPORTANTE (script NO idempotente):
--   Como son ALTER TABLE directos, si vuelves a ejecutar una sentencia sobre
--   una base donde el cambio ya existe, Oracle devolverá un error. Ignóralo y
--   continúa con la siguiente sentencia:
--     ORA-01430 -> la columna ya existe.
--     ORA-01451 -> id_casa ya admite NULL (la sentencia MODIFY no tiene efecto).
--     ORA-02264 -> el nombre de la restricción ya está en uso.
--     ORA-02275 -> la llave foránea ya existe en la tabla.
--
--   Las columnas nuevas se agregan con DEFAULT ... NOT NULL, por lo que Oracle
--   rellena automáticamente las filas existentes con el valor por defecto.
--   No se necesitan UPDATE de normalización.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COMUNICADO: destinatarios dinámicos y bandera de WhatsApp
-- ---------------------------------------------------------------------
ALTER TABLE COMUNICADO ADD (TIPO_DESTINATARIO VARCHAR2(20) DEFAULT 'TODOS' NOT NULL);
ALTER TABLE COMUNICADO ADD (ROL_DESTINO VARCHAR2(30));
ALTER TABLE COMUNICADO ADD (ENVIAR_WHATSAPP VARCHAR2(2) DEFAULT 'NO' NOT NULL);

-- ---------------------------------------------------------------------
-- 2. QUEJA: destinatario, canal de envío y bandera de WhatsApp
-- ---------------------------------------------------------------------
ALTER TABLE QUEJA ADD (ID_USUARIO_DESTINO NUMBER);
ALTER TABLE QUEJA ADD (TIPO_DESTINATARIO VARCHAR2(20) DEFAULT 'TODOS' NOT NULL);
ALTER TABLE QUEJA ADD (ROL_DESTINO VARCHAR2(30));
ALTER TABLE QUEJA ADD (CANAL_ENVIO VARCHAR2(30) DEFAULT 'APP' NOT NULL);
ALTER TABLE QUEJA ADD (ENVIAR_WHATSAPP VARCHAR2(2) DEFAULT 'NO' NOT NULL);

-- ---------------------------------------------------------------------
-- 3. QUEJA.id_casa opcional: admin/garita pueden no tener casa asociada
--    (si ya admite NULL, Oracle devuelve ORA-01451; ignóralo)
-- ---------------------------------------------------------------------
ALTER TABLE QUEJA MODIFY (ID_CASA NULL);

-- ---------------------------------------------------------------------
-- 4. Reglas de validación (CHECK)
-- ---------------------------------------------------------------------
ALTER TABLE COMUNICADO ADD CONSTRAINT CK_COMUNICADO_TIPO_DEST CHECK (TIPO_DESTINATARIO IN ('TODOS', 'ADMINISTRADOR', 'CONDOMINOS', 'GARITA', 'ESPECIFICO'));
ALTER TABLE COMUNICADO ADD CONSTRAINT CK_COMUNICADO_WHATSAPP CHECK (ENVIAR_WHATSAPP IN ('SI', 'NO'));
ALTER TABLE QUEJA ADD CONSTRAINT CK_QUEJA_TIPO_DEST CHECK (TIPO_DESTINATARIO IN ('TODOS', 'ADMINISTRADOR', 'CONDOMINOS', 'GARITA', 'ESPECIFICO'));
ALTER TABLE QUEJA ADD CONSTRAINT CK_QUEJA_CANAL CHECK (CANAL_ENVIO IN ('APP', 'EMAIL', 'WHATSAPP', 'AMBOS', 'TODOS'));
ALTER TABLE QUEJA ADD CONSTRAINT CK_QUEJA_WHATSAPP CHECK (ENVIAR_WHATSAPP IN ('SI', 'NO'));

-- ---------------------------------------------------------------------
-- 5. Integridad referencial del destinatario específico de una queja
-- ---------------------------------------------------------------------
ALTER TABLE QUEJA ADD CONSTRAINT FK_QUEJA_DESTINO FOREIGN KEY (ID_USUARIO_DESTINO) REFERENCES USUARIO (ID_USUARIO);

-- ---------------------------------------------------------------------
-- NOTA SOBRE ÍNDICES:
--   El script anterior creaba dos índices de rendimiento. No se incluyen aquí
--   porque no son sentencias ALTER TABLE. Si los quieres, ejecútalos aparte:
--
--   CREATE INDEX IDX_COMUNICADO_DESTINO ON COMUNICADO (TIPO_DESTINATARIO, ID_USUARIO_DESTINO, ESTADO);
--   CREATE INDEX IDX_QUEJA_DESTINO ON QUEJA (TIPO_DESTINATARIO, ID_USUARIO_DESTINO, ESTADO);
--
--   Si ya existen, Oracle devolverá ORA-00955; ignóralo.
-- ---------------------------------------------------------------------
