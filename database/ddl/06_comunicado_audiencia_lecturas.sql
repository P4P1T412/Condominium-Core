DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM USER_TAB_COLUMNS
  WHERE TABLE_NAME = 'COMUNICADO' AND COLUMN_NAME = 'TIPO_DESTINO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD (tipo_destino VARCHAR2(15) DEFAULT 'GLOBAL' NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_TAB_COLUMNS
  WHERE TABLE_NAME = 'COMUNICADO' AND COLUMN_NAME = 'PRIORIDAD';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD (prioridad VARCHAR2(10) DEFAULT 'NORMAL' NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_CONSTRAINTS
  WHERE TABLE_NAME = 'COMUNICADO' AND CONSTRAINT_NAME = 'CK_COMUNICADO_TIPO_DESTINO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD CONSTRAINT ck_comunicado_tipo_destino CHECK (tipo_destino IN ('GLOBAL', 'CASA', 'USUARIOS', 'ROLES', 'INDIVIDUAL'))]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_CONSTRAINTS
  WHERE TABLE_NAME = 'COMUNICADO' AND CONSTRAINT_NAME = 'CK_COMUNICADO_PRIORIDAD';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD CONSTRAINT ck_comunicado_prioridad CHECK (prioridad IN ('NORMAL', 'ALTA', 'URGENTE'))]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_TABLES
  WHERE TABLE_NAME = 'COMUNICADO_DESTINATARIO_ROL';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE COMUNICADO_DESTINATARIO_ROL (
        id_comunicado NUMBER NOT NULL,
        id_rol NUMBER NOT NULL,
        CONSTRAINT pk_comunicado_dest_rol PRIMARY KEY (id_comunicado, id_rol),
        CONSTRAINT fk_comunicado_dest_rol_com FOREIGN KEY (id_comunicado) REFERENCES COMUNICADO (id_comunicado),
        CONSTRAINT fk_comunicado_dest_rol_rol FOREIGN KEY (id_rol) REFERENCES ROL (id_rol)
      )
    ]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_TABLES
  WHERE TABLE_NAME = 'COMUNICADO_LECTURA';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE COMUNICADO_LECTURA (
        id_comunicado NUMBER NOT NULL,
        id_usuario NUMBER NOT NULL,
        fecha_lectura DATE DEFAULT SYSDATE NOT NULL,
        CONSTRAINT pk_comunicado_lectura PRIMARY KEY (id_comunicado, id_usuario),
        CONSTRAINT fk_comunicado_lectura_com FOREIGN KEY (id_comunicado) REFERENCES COMUNICADO (id_comunicado),
        CONSTRAINT fk_comunicado_lectura_usr FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario)
      )
    ]';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_INDEXES
  WHERE INDEX_NAME = 'IX_COM_DEST_USUARIO_USUARIO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_com_dest_usuario_usuario ON COMUNICADO_DESTINATARIO_USUARIO (id_usuario, id_comunicado)';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM USER_INDEXES
  WHERE INDEX_NAME = 'IX_COM_LECTURA_USUARIO';
  IF v_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_com_lectura_usuario ON COMUNICADO_LECTURA (id_usuario, id_comunicado)';
  END IF;
END;
/

UPDATE COMUNICADO c
SET tipo_destino = CASE
  WHEN c.id_casa_destino IS NOT NULL THEN 'CASA'
  WHEN c.id_usuario_destino IS NOT NULL THEN 'INDIVIDUAL'
  WHEN EXISTS (
    SELECT 1 FROM COMUNICADO_DESTINATARIO_USUARIO d
    WHERE d.id_comunicado = c.id_comunicado
  ) THEN 'USUARIOS'
  ELSE 'GLOBAL'
END
WHERE c.tipo_destino = 'GLOBAL'
  AND (c.id_casa_destino IS NOT NULL
    OR c.id_usuario_destino IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM COMUNICADO_DESTINATARIO_USUARIO d
      WHERE d.id_comunicado = c.id_comunicado
    ));

COMMIT;
