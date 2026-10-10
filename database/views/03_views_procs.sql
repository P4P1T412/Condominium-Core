-- =====================================================================
-- VISTA 1: Reporte de Morosidad (RF-09 para Dashboard de Administrador)
-- =====================================================================
CREATE OR REPLACE VIEW VW_CASAS_MOROSAS AS
SELECT 
    c.id_casa,
    c.numero_casa,
    c.bloque,
    p.nombres || ' ' || p.apellidos AS responsable,
    p.telefono,
    p.correo,
    COUNT(cu.id_cuota) AS cuotas_pendientes,
    SUM(cu.monto_total - NVL(pagos.total_abonado, 0)) AS total_adeudado,
    MIN(cu.fecha_vencimiento) AS fecha_vencimiento_mas_antigua,
    TRUNC(SYSDATE - MIN(cu.fecha_vencimiento)) AS dias_mora_maximo
FROM CASA c
JOIN PERSONA p ON c.id_propietario = p.id_persona
JOIN CUOTA cu ON c.id_casa = cu.id_casa
LEFT JOIN (
    SELECT id_cuota, SUM(monto_pagado) AS total_abonado
    FROM PAGO
    WHERE estado = 'VALIDO'
    GROUP BY id_cuota
) pagos ON cu.id_cuota = pagos.id_cuota
WHERE cu.estado IN ('PENDIENTE', 'PARCIAL', 'VENCIDA')
  AND cu.fecha_vencimiento < SYSDATE
GROUP BY 
    c.id_casa, c.numero_casa, c.bloque, 
    p.nombres, p.apellidos, p.telefono, p.correo;

-- =====================================================================
-- VISTA 2: Estado de Cuenta Individual (Portal del Condómino)
-- =====================================================================
CREATE OR REPLACE VIEW VW_ESTADO_CUENTA AS
SELECT 
    cu.id_cuota,
    cu.id_casa,
    c.numero_casa,
    cu.concepto,
    cu.periodo,
    cu.monto_total,
    NVL(pagos.total_pagado, 0) AS total_pagado,
    (cu.monto_total - NVL(pagos.total_pagado, 0)) AS saldo_pendiente,
    cu.fecha_emision,
    cu.fecha_vencimiento,
    cu.estado
FROM CUOTA cu
JOIN CASA c ON cu.id_casa = c.id_casa
LEFT JOIN (
    SELECT id_cuota, SUM(monto_pagado) AS total_pagado
    FROM PAGO
    WHERE estado = 'VALIDO'
    GROUP BY id_cuota
) pagos ON cu.id_cuota = pagos.id_cuota;

-- =====================================================================
-- VISTA 3: Padrón y Expediente Familiar por Casa
-- =====================================================================
CREATE OR REPLACE VIEW VW_EXPEDIENTE_CASA AS
SELECT 
    c.id_casa,
    c.numero_casa,
    c.bloque,
    r.id_residente,
    p.nombres || ' ' || p.apellidos AS nombre_completo,
    p.dpi,
    p.identificacion_alternativa,
    p.telefono,
    p.correo,
    r.tipo_residente,
    r.es_principal,
    r.estado AS estado_residencia
FROM CASA c
JOIN RESIDENTE r ON c.id_casa = r.id_casa
JOIN PERSONA p ON r.id_persona = p.id_persona;

-- =====================================================================
-- PROCEDIMIENTO: Registrar Pago de Mantenimiento con Auditoría Automática
-- =====================================================================
CREATE OR REPLACE PROCEDURE SP_REGISTRAR_PAGO (
    p_id_cuota         IN NUMBER,
    p_monto            IN NUMBER,
    p_metodo_pago      IN VARCHAR2,
    p_referencia       IN VARCHAR2,
    p_comprobante_url  IN VARCHAR2,
    p_id_usuario       IN NUMBER,
    p_ip_origen        IN VARCHAR2,
    p_id_pago_out      OUT NUMBER
) AS
BEGIN
    INSERT INTO PAGO (
        id_cuota,
        monto_pagado,
        metodo_pago,
        referencia,
        comprobante_url,
        estado,
        creado_por
    ) VALUES (
        p_id_cuota,
        p_monto,
        p_metodo_pago,
        p_referencia,
        p_comprobante_url,
        'PENDIENTE',
        p_id_usuario
    ) RETURNING id_pago INTO p_id_pago_out;

    INSERT INTO BITACORA_AUDITORIA (
        id_usuario,
        modulo,
        accion,
        tabla_afectada,
        id_registro_afectado,
        valor_nuevo,
        ip_origen
    ) VALUES (
        p_id_usuario,
        'PAGOS',
        'REGISTRAR_COMPROBANTE',
        'PAGO',
        p_id_pago_out,
        '{"id_cuota": ' || p_id_cuota || ', "monto": ' || p_monto || ', "estado": "PENDIENTE"}',
        p_ip_origen
    );

    COMMIT;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END SP_REGISTRAR_PAGO;
