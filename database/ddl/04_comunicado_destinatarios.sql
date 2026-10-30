DECLARE
  v_table_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM USER_TABLES
  WHERE TABLE_NAME = 'COMUNICADO_DESTINATARIO_USUARIO';

  IF v_table_count = 0 THEN
    EXECUTE IMMEDIATE q'[
      CREATE TABLE COMUNICADO_DESTINATARIO_USUARIO (
        id_comunicado NUMBER NOT NULL,
        id_usuario NUMBER NOT NULL,
        CONSTRAINT pk_comunicado_dest_usuario PRIMARY KEY (id_comunicado, id_usuario),
        CONSTRAINT fk_comunicado_dest_usuario_com FOREIGN KEY (id_comunicado) REFERENCES COMUNICADO (id_comunicado),
        CONSTRAINT fk_comunicado_dest_usuario_usr FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario)
      )
    ]';
  END IF;
END;
/

INSERT INTO COMUNICADO_DESTINATARIO_USUARIO (id_comunicado, id_usuario)
SELECT c.id_comunicado, c.id_usuario_destino
FROM COMUNICADO c
WHERE c.id_usuario_destino IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM COMUNICADO_DESTINATARIO_USUARIO d
    WHERE d.id_comunicado = c.id_comunicado
      AND d.id_usuario = c.id_usuario_destino
  );

COMMIT;
