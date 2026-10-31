-- 1. Crear la tabla EVENTO_VISITA
CREATE TABLE EVENTO_VISITA (
    id_evento NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_casa NUMBER NOT NULL,
    nombre_evento VARCHAR2(150) NOT NULL,
    fecha_evento DATE NOT NULL,
    total_invitados NUMBER DEFAULT 0,
    solicitado_por NUMBER,
    estado_aprobacion VARCHAR2(30) DEFAULT 'PENDIENTE',
    motivo_rechazo VARCHAR2(255),
    fecha_creacion TIMESTAMP DEFAULT SYSTIMESTAMP,
    CONSTRAINT fk_evento_casa FOREIGN KEY (id_casa) REFERENCES CASA(id_casa)
);

-- 2. Asegurar que la tabla VISITA tenga la columna TOKEN_QR
ALTER TABLE VISITA ADD (token_qr VARCHAR2(100));

-- 3. Asegurar las columnas adicionales en VISITA
ALTER TABLE VISITA ADD (id_evento NUMBER);
ALTER TABLE VISITA ADD (id_residente NUMBER);

-- 4. Agregar relación foreign key entre VISITA y EVENTO_VISITA
ALTER TABLE VISITA ADD CONSTRAINT fk_visita_evento FOREIGN KEY (id_evento) REFERENCES EVENTO_VISITA(id_evento);

COMMIT;