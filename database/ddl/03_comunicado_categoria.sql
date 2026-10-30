DECLARE
  v_column_count NUMBER;
  v_constraint_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_column_count
  FROM USER_TAB_COLUMNS
  WHERE TABLE_NAME = 'COMUNICADO'
    AND COLUMN_NAME = 'CATEGORIA';

  IF v_column_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD (categoria VARCHAR2(50) DEFAULT 'General' NOT NULL)]';
  END IF;

  SELECT COUNT(*) INTO v_constraint_count
  FROM USER_CONSTRAINTS
  WHERE TABLE_NAME = 'COMUNICADO'
    AND CONSTRAINT_NAME = 'CK_COMUNICADO_CATEGORIA';

  IF v_constraint_count = 0 THEN
    EXECUTE IMMEDIATE q'[ALTER TABLE COMUNICADO ADD CONSTRAINT ck_comunicado_categoria CHECK (categoria IN ('Mantenimiento', 'Seguridad', 'Eventos', 'Administración', 'General'))]';
  END IF;
END;
/