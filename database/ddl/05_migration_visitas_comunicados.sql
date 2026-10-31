-- =====================================================================
-- MIGRACIÓN: MÓDULO "VISITAS Y COMUNICADOS"
-- Archivo: database/ddl/05_migration_visitas_comunicados.sql
-- ---------------------------------------------------------------------
-- Objetivo:
--   Poner al día una base de datos YA EXISTENTE con los cambios que se
--   agregaron a 01_schema.sql sin borrar ni recrear tablas.
--
--   El script es completamente idempotente y está optimizado en un solo
--   bloque PL/SQL para ejecutarse en DBeaver (Alt + X) o SQL Developer.
-- =====================================================================

DECLARE
  v_existe NUMBER;

  -- Procedimiento auxiliar para agregar columnas si no existen
  PROCEDURE agregar_columna(p_tabla VARCHAR2, p_columna VARCHAR2, p_tipo VARCHAR2) IS
  BEGIN
    SELECT COUNT(*) INTO v_existe
      FROM user_tab_cols
     WHERE table_name = UPPER(p_tabla)
       AND column_name = UPPER(p_columna);

    IF v_existe = 0 THEN
      EXECUTE IMMEDIATE 'ALTER TABLE ' || p_tabla || ' ADD (' || p_columna || ' ' || p_tipo || ')';
      DBMS_OUTPUT.PUT_LINE('[OK] ' || p_tabla || '.' || p_columna || ' agregada.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[INFO] ' || p_tabla || '.' || p_columna || ' ya existía.');
    END IF;
  END agregar_columna;

  -- Procedimiento auxiliar para crear índices si no existen
  PROCEDURE crear_indice(p_indice VARCHAR2, p_ddl VARCHAR2) IS
  BEGIN
    SELECT COUNT(*) INTO v_existe
      FROM user_indexes
     WHERE index_name = UPPER(p_indice);

    IF v_existe = 0 THEN
      EXECUTE IMMEDIATE p_ddl;
      DBMS_OUTPUT.PUT_LINE('[OK] Índice ' || p_indice || ' creado.');
    ELSE
      DBMS_OUTPUT.PUT_LINE('[INFO] Índice ' || p_indice || ' ya existía.');
    END IF;
  END crear_indice;

BEGIN

  -- 1. EVENTO_VISITA: SALON_ASIGNADO
  agregar_columna('EVENTO_VISITA', 'SALON_ASIGNADO', 'VARCHAR2(100)');

  -- 2. VISITA: NUMERO_PARQUEO y columnas adicionales del módulo
  agregar_columna('VISITA', 'NUMERO_PARQUEO', 'NUMBER(5)');
  agregar_columna('VISITA', 'ID_EVENTO', 'NUMBER');
  agregar_columna('VISITA', 'CORREO_VISITANTE', 'VARCHAR2(120)');
  agregar_columna('VISITA', 'PLACA_VEHICULO', 'VARCHAR2(20)');
  agregar_columna('VISITA', 'TOKEN_QR', 'VARCHAR2(255)');

  -- 3. COMUNICADO: columnas para notificaciones dirigidas
  agregar_columna('COMUNICADO', 'ID_USUARIO_DESTINO', 'NUMBER');
  agregar_columna('COMUNICADO', 'CANAL_ENVIO', 'VARCHAR2(30) DEFAULT ''APP'' NOT NULL');

  -- 4. ACCESO: id_servicio y llave foránea
  agregar_columna('ACCESO', 'ID_SERVICIO', 'NUMBER');

  SELECT COUNT(*) INTO v_existe
    FROM user_constraints
   WHERE table_name = 'ACCESO'
     AND constraint_name = 'FK_ACCESO_SERVICIO';

  IF v_existe = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ACCESO ADD CONSTRAINT fk_acceso_servicio '
                   || 'FOREIGN KEY (id_servicio) REFERENCES SERVICIO_EXTERNO (id_servicio)';
    DBMS_OUTPUT.PUT_LINE('[OK] FK ACCESO -> SERVICIO_EXTERNO creada.');
  END IF;

  -- 5. ACTUALIZACIÓN DE CHECK CONSTRAINTS
  -- EVENTO_VISITA: ck_evento_estado
  SELECT COUNT(*) INTO v_existe
    FROM user_constraints
   WHERE table_name = 'EVENTO_VISITA'
     AND constraint_name = 'CK_EVENTO_ESTADO';

  IF v_existe > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE EVENTO_VISITA DROP CONSTRAINT ck_evento_estado';
  END IF;

  EXECUTE IMMEDIATE 'ALTER TABLE EVENTO_VISITA ADD CONSTRAINT ck_evento_estado CHECK ('
                 || 'estado_aprobacion IN (''PENDIENTE'', ''PENDIENTE_APROBACION'', ''APROBADO'', ''ENVIADO_GARITA'', ''RECHAZADO''))';
  DBMS_OUTPUT.PUT_LINE('[OK] CK_EVENTO_ESTADO actualizado.');

  -- VISITA: ck_visita_estado
  SELECT COUNT(*) INTO v_existe
    FROM user_constraints
   WHERE table_name = 'VISITA'
     AND constraint_name = 'CK_VISITA_ESTADO';

  IF v_existe > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE VISITA DROP CONSTRAINT ck_visita_estado';
  END IF;

  EXECUTE IMMEDIATE 'ALTER TABLE VISITA ADD CONSTRAINT ck_visita_estado CHECK ('
                 || 'estado IN (''PENDIENTE'', ''PENDIENTE_APROBACION'', ''AUTORIZADA'', ''DENTRO'', ''FINALIZADA'', ''CANCELADA'', ''DENEGADA''))';
  DBMS_OUTPUT.PUT_LINE('[OK] CK_VISITA_ESTADO actualizado.');

  -- 6. ELIMINACIÓN DE CONSTRAINT OBSOLETA DE ACCESO
  SELECT COUNT(*) INTO v_existe
    FROM user_constraints
   WHERE table_name = 'ACCESO'
     AND constraint_name = 'CK_ACCESO_TIPO_PERSONA';

  IF v_existe > 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE ACCESO DROP CONSTRAINT ck_acceso_tipo_persona';
    DBMS_OUTPUT.PUT_LINE('[OK] CK_ACCESO_TIPO_PERSONA obsoleta eliminada.');
  END IF;

  -- 7. ÍNDICES DE RENDIMIENTO
  crear_indice('IDX_VISITA_ESTADO_FECHA', 'CREATE INDEX idx_visita_estado_fecha ON VISITA (estado, fecha_esperada)');
  crear_indice('IDX_EVENTO_ESTADO', 'CREATE INDEX idx_evento_estado ON EVENTO_VISITA (estado_aprobacion)');
  crear_indice('IDX_VISITA_GARITA_BUSQUEDA', 'CREATE INDEX idx_visita_garita_busqueda ON VISITA (identificacion, placa_vehiculo, estado)');
  crear_indice('IDX_VISITA_RESIDENTE', 'CREATE INDEX idx_visita_residente ON VISITA (id_residente, estado)');
  crear_indice('IDX_EVENTO_SOLICITADO', 'CREATE INDEX idx_evento_solicitado ON EVENTO_VISITA (solicitado_por)');

  COMMIT;
END;
/