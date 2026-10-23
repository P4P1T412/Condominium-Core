-- =====================================================================
-- NOTA DE EJECUCIÓN EN DBEAVER
-- Cada trigger se define dentro de un bloque PL/SQL anónimo mediante
-- EXECUTE IMMEDIATE. Así puede ejecutarse de forma individual (seleccione
-- el bloque y use Ctrl+Enter) o ejecutar todo el archivo como script
-- (Alt+X), sin depender de líneas "/" como separador.
-- =====================================================================


BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 1. Validar que un pago con estado 'VALIDO' no exceda el saldo.
-- Se usa compound trigger porque consultar PAGO desde un trigger fila a fila
-- provoca ORA-04091 (tabla mutante) al aprobar un comprobante.
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_pago_validar_monto
FOR INSERT OR UPDATE OF monto_pagado, estado ON PAGO
COMPOUND TRIGGER
    TYPE t_pago IS RECORD (
        id_pago PAGO.id_pago%TYPE,
        id_cuota PAGO.id_cuota%TYPE,
        monto_pagado PAGO.monto_pagado%TYPE,
        estado PAGO.estado%TYPE
    );
    TYPE t_pagos IS TABLE OF t_pago INDEX BY PLS_INTEGER;
    v_pagos t_pagos;
    v_contador PLS_INTEGER := 0;
    v_monto_total CUOTA.monto_total%TYPE;
    v_total_pagado NUMBER(10,2);

    AFTER EACH ROW IS
    BEGIN
        IF :NEW.estado = 'VALIDO' THEN
            v_contador := v_contador + 1;
            v_pagos(v_contador).id_pago := :NEW.id_pago;
            v_pagos(v_contador).id_cuota := :NEW.id_cuota;
            v_pagos(v_contador).monto_pagado := :NEW.monto_pagado;
            v_pagos(v_contador).estado := :NEW.estado;
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
    BEGIN
        FOR i IN 1 .. v_contador LOOP
            SELECT monto_total INTO v_monto_total
            FROM CUOTA
            WHERE id_cuota = v_pagos(i).id_cuota;

            SELECT NVL(SUM(monto_pagado), 0)
            INTO v_total_pagado
            FROM PAGO
            WHERE id_cuota = v_pagos(i).id_cuota
              AND estado = 'VALIDO'
              AND id_pago <> NVL(v_pagos(i).id_pago, -1);

            IF v_pagos(i).monto_pagado > v_monto_total - v_total_pagado THEN
                RAISE_APPLICATION_ERROR(
                    -20001,
                    'El pago de Q' || v_pagos(i).monto_pagado ||
                    ' excede el saldo restante (Q' ||
                    (v_monto_total - v_total_pagado) || ').'
                );
            END IF;
        END LOOP;
    END AFTER STATEMENT;
END trg_pago_validar_monto;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 2. Compound Trigger para actualizar CUOTA sin mutación de tabla (ORA-04091)
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_pago_actualizar_cuota
FOR INSERT OR UPDATE OF estado, monto_pagado ON PAGO
COMPOUND TRIGGER
    TYPE t_ids_cuota IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
    v_ids_cuota t_ids_cuota;
    v_contador  PLS_INTEGER := 0;

    AFTER EACH ROW IS
    BEGIN
        v_contador := v_contador + 1;
        v_ids_cuota(v_contador) := :NEW.id_cuota;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
        v_monto_total  CUOTA.monto_total%TYPE;
        v_total_pagado NUMBER(10,2);
    BEGIN
        FOR i IN 1 .. v_contador LOOP
            SELECT monto_total INTO v_monto_total FROM CUOTA WHERE id_cuota = v_ids_cuota(i);

            SELECT NVL(SUM(monto_pagado), 0)
            INTO v_total_pagado
            FROM PAGO
            WHERE id_cuota = v_ids_cuota(i) AND estado = 'VALIDO';

            UPDATE CUOTA
            SET estado = CASE
                            WHEN v_total_pagado = 0 THEN 'PENDIENTE'
                            WHEN v_total_pagado < v_monto_total THEN 'PARCIAL'
                            ELSE 'PAGADA'
                         END
            WHERE id_cuota = v_ids_cuota(i) AND estado <> 'ANULADA';
        END LOOP;
    END AFTER STATEMENT;
END trg_pago_actualizar_cuota;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 3. Sincronizar estado de Multa con su Cuota
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_cuota_actualizar_multa
AFTER UPDATE OF estado ON CUOTA
FOR EACH ROW
WHEN (NEW.id_multa IS NOT NULL)
BEGIN
    IF :NEW.estado = 'PAGADA' THEN
        UPDATE MULTA SET estado = 'PAGADA' WHERE id_multa = :NEW.id_multa;
    ELSIF :NEW.estado = 'ANULADA' THEN
        UPDATE MULTA SET estado = 'ANULADA' WHERE id_multa = :NEW.id_multa;
    END IF;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 4. Validar Capacidad de Área Común al Reservar
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_reservacion_capacidad
BEFORE INSERT OR UPDATE OF id_area, cantidad_personas ON RESERVACION
FOR EACH ROW
DECLARE
    v_capacidad AREA_COMUN.capacidad%TYPE;
BEGIN
    SELECT capacidad INTO v_capacidad FROM AREA_COMUN WHERE id_area = :NEW.id_area;
    IF :NEW.cantidad_personas > v_capacidad THEN
        RAISE_APPLICATION_ERROR(-20010, 'La cantidad de personas excede la capacidad maxima (' || v_capacidad || ') del area.');
    END IF;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 5. Compound Trigger para Cruces de Horario en Reservaciones
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_reservacion_horario
FOR INSERT OR UPDATE OF id_area, fecha_reserva, hora_inicio, hora_fin, estado ON RESERVACION
COMPOUND TRIGGER
    TYPE t_reserva IS RECORD (
        id_reservacion RESERVACION.id_reservacion%TYPE,
        id_area        RESERVACION.id_area%TYPE,
        fecha_reserva  RESERVACION.fecha_reserva%TYPE,
        hora_inicio    RESERVACION.hora_inicio%TYPE,
        hora_fin       RESERVACION.hora_fin%TYPE,
        estado         RESERVACION.estado%TYPE
    );
    TYPE t_reservas IS TABLE OF t_reserva INDEX BY PLS_INTEGER;
    v_reservas t_reservas;
    v_contador PLS_INTEGER := 0;

    AFTER EACH ROW IS
    BEGIN
        v_contador := v_contador + 1;
        v_reservas(v_contador).id_reservacion := :NEW.id_reservacion;
        v_reservas(v_contador).id_area        := :NEW.id_area;
        v_reservas(v_contador).fecha_reserva  := :NEW.fecha_reserva;
        v_reservas(v_contador).hora_inicio    := :NEW.hora_inicio;
        v_reservas(v_contador).hora_fin       := :NEW.hora_fin;
        v_reservas(v_contador).estado         := :NEW.estado;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
        v_conflictos NUMBER;
    BEGIN
        FOR i IN 1 .. v_contador LOOP
            IF v_reservas(i).estado IN ('PENDIENTE', 'CONFIRMADA') THEN
                SELECT COUNT(*)
                INTO v_conflictos
                FROM RESERVACION r
                WHERE r.id_area = v_reservas(i).id_area
                  AND TRUNC(r.fecha_reserva) = TRUNC(v_reservas(i).fecha_reserva)
                  AND r.id_reservacion <> NVL(v_reservas(i).id_reservacion, -1)
                  AND r.estado IN ('PENDIENTE', 'CONFIRMADA')
                  AND r.hora_inicio < v_reservas(i).hora_fin
                  AND r.hora_fin > v_reservas(i).hora_inicio;

                IF v_conflictos > 0 THEN
                    RAISE_APPLICATION_ERROR(-20011, 'El area seleccionada ya posee una reservacion en el rango de horario solicitado.');
                END IF;
            END IF;
        END LOOP;
    END AFTER STATEMENT;
END trg_reservacion_horario;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 6. Máquina de Estados de Accesos en Garita (Entrada/Salida Alternada)
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_acceso_secuencia
BEFORE INSERT ON ACCESO
FOR EACH ROW
DECLARE
    v_ultimo_movimiento ACCESO.tipo_movimiento%TYPE;
BEGIN
    IF :NEW.tipo_persona = 'RESIDENTE' THEN
        BEGIN
            SELECT tipo_movimiento INTO v_ultimo_movimiento
            FROM (SELECT tipo_movimiento FROM ACCESO WHERE id_residente = :NEW.id_residente ORDER BY fecha_hora DESC, id_acceso DESC)
            WHERE ROWNUM = 1;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN v_ultimo_movimiento := NULL;
        END;
    ELSIF :NEW.tipo_persona = 'VISITANTE' THEN
        BEGIN
            SELECT tipo_movimiento INTO v_ultimo_movimiento
            FROM (SELECT tipo_movimiento FROM ACCESO WHERE id_visita = :NEW.id_visita ORDER BY fecha_hora DESC, id_acceso DESC)
            WHERE ROWNUM = 1;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN v_ultimo_movimiento := NULL;
        END;
    END IF;

    IF v_ultimo_movimiento IS NULL AND :NEW.tipo_movimiento <> 'ENTRADA' THEN
        RAISE_APPLICATION_ERROR(-20020, 'El primer movimiento registrado debe ser obligatoriamente ENTRADA.');
    END IF;

    IF v_ultimo_movimiento = :NEW.tipo_movimiento THEN
        RAISE_APPLICATION_ERROR(-20021, 'Movimiento invalido. Debe alternar entre ENTRADA y SALIDA.');
    END IF;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 7. Triggers de Auditoría Automática para fecha_modificacion
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_casa_audit_fecha
BEFORE UPDATE ON CASA
FOR EACH ROW
BEGIN
    :NEW.fecha_modificacion := SYSTIMESTAMP;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
CREATE OR REPLACE TRIGGER trg_pago_audit_fecha
BEFORE UPDATE ON PAGO
FOR EACH ROW
BEGIN
    :NEW.fecha_modificacion := SYSTIMESTAMP;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
CREATE OR REPLACE TRIGGER trg_cuota_audit_fecha
BEFORE UPDATE ON CUOTA
FOR EACH ROW
BEGIN
    :NEW.fecha_modificacion := SYSTIMESTAMP;
END;
    ]';
END;

BEGIN
    EXECUTE IMMEDIATE q'[
-- =====================================================================
-- 8. Sincronizar el estado de CASA al vincular o desvincular residentes.
-- Se usa un compound trigger para consultar RESIDENTE solo en AFTER
-- STATEMENT y evitar ORA-04091 (tabla mutante) en operaciones masivas.
-- =====================================================================
CREATE OR REPLACE TRIGGER trg_residente_sync_casa_estado
FOR INSERT OR UPDATE OF estado, id_casa OR DELETE ON RESIDENTE
COMPOUND TRIGGER
    TYPE t_casas IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
    v_casas t_casas;
    v_contador PLS_INTEGER := 0;

    PROCEDURE registrar_casa(p_id_casa NUMBER) IS
    BEGIN
        IF p_id_casa IS NOT NULL THEN
            v_contador := v_contador + 1;
            v_casas(v_contador) := p_id_casa;
        END IF;
    END registrar_casa;

    AFTER EACH ROW IS
    BEGIN
        IF INSERTING THEN
            registrar_casa(:NEW.id_casa);
        ELSIF DELETING THEN
            registrar_casa(:OLD.id_casa);
        ELSIF UPDATING THEN
            registrar_casa(:OLD.id_casa);
            registrar_casa(:NEW.id_casa);
        END IF;
    END AFTER EACH ROW;

    AFTER STATEMENT IS
    BEGIN
        FOR i IN 1 .. v_contador LOOP
            UPDATE CASA c
            SET estado = CASE
                    WHEN c.estado = 'INACTIVA' THEN 'INACTIVA'
                    WHEN EXISTS (
                        SELECT 1
                        FROM RESIDENTE r
                        WHERE r.id_casa = c.id_casa
                          AND r.estado = 'ACTIVO'
                    ) THEN 'OCUPADA'
                    ELSE 'DISPONIBLE'
                END
            WHERE c.id_casa = v_casas(i);
        END LOOP;
    END AFTER STATEMENT;
END;
    ]';
END;
