-- 1. Roles del Sistema
INSERT INTO ROL (nombre, descripcion) VALUES ('ADMINISTRADOR', 'Gestion y administracion total del condominio');
INSERT INTO ROL (nombre, descripcion) VALUES ('CONDOMINO', 'Residentes o propietarios responsables de casas');
INSERT INTO ROL (nombre, descripcion) VALUES ('GARITA', 'Personal de vigilancia y control de acceso');
COMMIT;

-- 2. Personas Físicas
-- ID 1: Administrador
INSERT INTO PERSONA (nombres, apellidos, dpi, telefono, correo, fecha_nacimiento)
VALUES ('ADMINISTRADOR', 'SISTEMA', '1000000000101', '50001111', 'admin@condominio.gt', DATE '1985-01-10');

-- ID 2: Condómino Titular (Casa A-101)
INSERT INTO PERSONA (nombres, apellidos, dpi, telefono, correo, fecha_nacimiento)
VALUES ('JUAN CARLOS', 'PEREZ LOPEZ', '1234567890101', '55551234', 'juan.perez@email.com', DATE '1990-05-15');

-- ID 3: Familiar sin login (Hijo menor de Juan Pérez)
INSERT INTO PERSONA (nombres, apellidos, identificacion_alternativa, telefono)
VALUES ('PEDRO', 'PEREZ LOPEZ', 'MENOR-0001', '55551234');

-- ID 4: Guardia de Garita
INSERT INTO PERSONA (nombres, apellidos, dpi, telefono, correo, fecha_nacimiento)
VALUES ('MIGUEL ANGEL', 'GUARDIA', '2222333340101', '59990000', 'garita@condominio.gt', DATE '1992-08-20');
COMMIT;

-- 3. Usuarios de Sistema con Hash de Bcrypt
-- Passwords reales para pruebas locales:
-- admin: 'admin123'
INSERT INTO USUARIO (id_persona, id_rol, nombre_usuario, contrasena, es_verificado)
VALUES (1, 1, 'admin', '$2b$10$QgHeXQifYUlrBucPFWQceu0JY6vVH9XJaJ851JogCM0bYC8zNRQvm', 'SI');

-- condomino: 'condomino123'
INSERT INTO USUARIO (id_persona, id_rol, nombre_usuario, contrasena, es_verificado)
VALUES (2, 2, 'jperez', '$2b$10$QgHeXQifYUlrBucPFWQceu0JY6vVH9XJaJ851JogCM0bYC8zNRQvm', 'SI');

-- garita: 'garita123'
INSERT INTO USUARIO (id_persona, id_rol, nombre_usuario, contrasena, es_verificado)
VALUES (4, 3, 'garita1', '$2b$10$QgHeXQifYUlrBucPFWQceu0JY6vVH9XJaJ851JogCM0bYC8zNRQvm', 'SI');
COMMIT;

-- 4. Casas
INSERT INTO CASA (id_propietario, numero_casa, bloque, direccion, estado, creado_por)
VALUES (2, 'A-101', 'BLOQUE A', 'Sector Norte Calle Principal Casa 1', 'OCUPADA', 1);

INSERT INTO CASA (id_propietario, numero_casa, bloque, direccion, estado, creado_por)
VALUES (2, 'A-102', 'BLOQUE A', 'Sector Norte Calle Principal Casa 2', 'DISPONIBLE', 1);
COMMIT;

-- 5. Expediente Familiar (Habitantes de la casa A-101)
INSERT INTO RESIDENTE (id_persona, id_casa, tipo_residente, es_principal)
VALUES (2, 1, 'PROPIETARIO', 'SI');

INSERT INTO RESIDENTE (id_persona, id_casa, tipo_residente, es_principal)
VALUES (3, 1, 'FAMILIAR', 'NO');
COMMIT;

-- 6. Áreas Comunes
INSERT INTO AREA_COMUN (nombre, descripcion, capacidad, ubicacion, estado)
VALUES ('SALON SOCIAL', 'Area para reuniones sociales de condominos', 80, 'Sector Central Edificio B', 'DISPONIBLE');

INSERT INTO AREA_COMUN (nombre, descripcion, capacidad, ubicacion, estado)
VALUES ('PISCINA', 'Piscina para residentes y familiares autorizados', 40, 'Area Recreativa', 'DISPONIBLE');
COMMIT;

-- 7. Cuotas (Periodo 2026-07 vencida para probar morosidad y 2026-08 pendiente)
INSERT INTO CUOTA (id_casa, concepto, periodo, monto_total, fecha_emision, fecha_vencimiento, estado, creado_por)
VALUES (1, 'MANTENIMIENTO', '2026-07', 350.00, DATE '2026-07-01', DATE '2026-07-31', 'PENDIENTE', 1);

INSERT INTO CUOTA (id_casa, concepto, periodo, monto_total, fecha_emision, fecha_vencimiento, estado, creado_por)
VALUES (1, 'MANTENIMIENTO', '2026-08', 350.00, DATE '2026-08-01', DATE '2026-08-31', 'PENDIENTE', 1);
COMMIT;

-- 8. Pago de prueba subido por el condómino
INSERT INTO PAGO (id_cuota, monto_pagado, metodo_pago, referencia, comprobante_url, estado, creado_por)
VALUES (1, 350.00, 'TRANSFERENCIA', 'TRX-998877', '/uploads/comprobantes/recibo_julio_2026.pdf', 'PENDIENTE', 2);
COMMIT;

-- 9. Comunicado General de Prueba
INSERT INTO COMUNICADO (id_usuario, titulo, contenido, estado)
VALUES (1, 'BIENVENIDA AL NUEVO SISTEMA', 'Estimados vecinos, se ha puesto en marcha la nueva plataforma de gestion residencial.', 'ACTIVO');
COMMIT;