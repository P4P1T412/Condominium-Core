const fs = require("fs");
const path = require("path");
const oracledb = require("oracledb");
const { executeQuery } = require("../../config/db");

function mapPayment(row) {
  return {
    idPago: row.ID_PAGO,
    idCuota: row.ID_CUOTA,
    casa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    propietario: row.PROPIETARIO,
    periodo: row.PERIODO,
    concepto: row.CONCEPTO,
    monto: row.MONTO_PAGADO,
    fechaPago: row.FECHA_PAGO,
    metodo: row.METODO_PAGO,
    referencia: row.REFERENCIA,
    comprobanteUrl: row.COMPROBANTE_URL,
    estado: row.ESTADO,
    observacionRechazo: row.OBSERVACION_RECHAZO,
  };
}

async function getPendingPayments() {
  const result = await executeQuery(`
    SELECT p.id_pago, p.id_cuota, c.numero_casa, c.bloque,
           per.nombres || ' ' || per.apellidos AS propietario,
           cu.periodo, cu.concepto, p.monto_pagado, p.fecha_pago,
           p.metodo_pago, p.referencia, p.comprobante_url, p.estado,
           p.observacion_rechazo
    FROM PAGO p
    JOIN CUOTA cu ON cu.id_cuota = p.id_cuota
    JOIN CASA c ON c.id_casa = cu.id_casa
    JOIN PERSONA per ON per.id_persona = c.id_propietario
    WHERE p.estado = 'PENDIENTE'
    ORDER BY p.fecha_pago ASC, p.id_pago ASC
  `);

  return result.rows.map(mapPayment);
}

const ACCOUNT_QUERY = `
  SELECT c.id_casa, c.numero_casa, c.bloque, cu.id_cuota AS id_registro,
         CAST(NULL AS NUMBER) AS id_multa, 'CUOTA' AS tipo,
         (SELECT MAX(p.id_pago) FROM PAGO p WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO') AS id_pago,
         (SELECT estado FROM (SELECT p.estado FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS estado_pago,
         (SELECT observacion_rechazo FROM (SELECT p.observacion_rechazo FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS observacion_pago,
         (SELECT comprobante_url FROM (SELECT p.comprobante_url FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS comprobante_pago,
         (SELECT monto_pagado FROM (SELECT p.monto_pagado FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS pago_monto,
         (SELECT fecha_pago FROM (SELECT p.fecha_pago FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS pago_fecha,
         (SELECT metodo_pago FROM (SELECT p.metodo_pago FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS pago_metodo,
         (SELECT referencia FROM (SELECT p.referencia FROM PAGO p WHERE p.id_cuota = cu.id_cuota ORDER BY p.id_pago DESC) WHERE ROWNUM = 1) AS pago_referencia,
         cu.periodo, cu.concepto, cu.monto_total AS monto,
         NVL((SELECT SUM(p.monto_pagado) FROM PAGO p
              WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO'), 0) AS pagado,
         cu.fecha_emision, cu.fecha_vencimiento,
         CASE
           WHEN cu.estado = 'ANULADA' THEN 'ANULADA'
           WHEN NVL((SELECT SUM(p.monto_pagado) FROM PAGO p
                    WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO'), 0) >= cu.monto_total THEN 'PAGADA'
           WHEN cu.fecha_vencimiento < TRUNC(SYSDATE) THEN 'VENCIDA'
           ELSE cu.estado
         END AS estado
  FROM CUOTA cu
  JOIN CASA c ON c.id_casa = cu.id_casa
  WHERE c.id_casa IN (
    SELECT id_casa FROM CASA WHERE id_propietario = :personaId
    UNION
    SELECT id_casa FROM RESIDENTE WHERE id_persona = :personaId AND estado = 'ACTIVO'
  )
  UNION ALL
  SELECT c.id_casa, c.numero_casa, c.bloque, CAST(NULL AS NUMBER) AS id_registro,
         m.id_multa, 'MULTA' AS tipo, CAST(NULL AS NUMBER) AS id_pago,
         CAST(NULL AS VARCHAR2(15)) AS estado_pago,
         CAST(NULL AS VARCHAR2(250)) AS observacion_pago,
         CAST(NULL AS VARCHAR2(500)) AS comprobante_pago,
         CAST(NULL AS NUMBER) AS pago_monto,
         CAST(NULL AS DATE) AS pago_fecha,
         CAST(NULL AS VARCHAR2(20)) AS pago_metodo,
         CAST(NULL AS VARCHAR2(80)) AS pago_referencia,
         TO_CHAR(m.fecha_multa, 'YYYY-MM') AS periodo,
         m.motivo AS concepto, m.monto,
         NVL((SELECT SUM(cu.monto_total - NVL((SELECT SUM(p.monto_pagado)
              FROM PAGO p WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO'), 0))
              FROM CUOTA cu WHERE cu.id_multa = m.id_multa), 0) AS pagado,
         m.fecha_multa, m.fecha_vencimiento,
         m.estado
  FROM MULTA m
  JOIN CASA c ON c.id_casa = m.id_casa
  WHERE c.id_casa IN (
    SELECT id_casa FROM CASA WHERE id_propietario = :personaId
    UNION
    SELECT id_casa FROM RESIDENTE WHERE id_persona = :personaId AND estado = 'ACTIVO'
  )
`;

function mapAccount(row) {
  const paid = Number(row.PAGADO || 0);
  const amount = Number(row.MONTO || 0);
  return {
    idCasa: row.ID_CASA,
    casa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    idCuota: row.ID_REGISTRO,
    idMulta: row.ID_MULTA,
    idPago: row.ID_PAGO,
    estadoPago: row.ESTADO_PAGO,
    observacionPago: row.OBSERVACION_PAGO,
    comprobantePago: row.COMPROBANTE_PAGO,
    pagoMonto: row.PAGO_MONTO,
    pagoFecha: row.PAGO_FECHA,
    pagoMetodo: row.PAGO_METODO,
    pagoReferencia: row.PAGO_REFERENCIA,
    tipo: row.TIPO,
    periodo: row.PERIODO,
    concepto: row.CONCEPTO,
    monto: amount,
    pagado: paid,
    saldo: Math.max(amount - paid, 0),
    fechaEmision: row.FECHA_EMISION,
    fechaVencimiento: row.FECHA_VENCIMIENTO,
    estado: row.ESTADO,
    aplicable: row.TIPO === "CUOTA" && !["PAGADA", "ANULADA"].includes(row.ESTADO)
      && row.ESTADO_PAGO !== "PENDIENTE",
  };
}

async function ensureMonthlyFees(personaId) {
  const periodResult = await executeQuery(`
    SELECT TO_NUMBER(TO_CHAR(SYSDATE, 'YYYY')) AS anio,
           TO_NUMBER(TO_CHAR(SYSDATE, 'MM')) AS mes
    FROM dual
  `);
  const currentYear = Number(periodResult.rows[0].ANIO);
  const currentMonth = Number(periodResult.rows[0].MES);

  const housesResult = await executeQuery(`
    SELECT id_casa
    FROM CASA
    WHERE estado <> 'INACTIVA'
      AND id_casa IN (
        SELECT id_casa FROM CASA WHERE id_propietario = :personaId
        UNION
        SELECT id_casa FROM RESIDENTE
        WHERE id_persona = :personaId AND estado = 'ACTIVO'
      )
  `, { personaId: Number(personaId) });

  for (const house of housesResult.rows) {
    const templateResult = await executeQuery(`
      SELECT concepto, monto_total, creado_por
      FROM (
        SELECT concepto, monto_total, creado_por
        FROM CUOTA
        WHERE id_casa = :idCasa
          AND id_multa IS NULL
        ORDER BY periodo DESC
      )
      WHERE ROWNUM = 1
    `, { idCasa: house.ID_CASA });

    if (!templateResult.rows.length) continue;
    const template = templateResult.rows[0];

    for (let month = 1; month <= currentMonth; month += 1) {
      const periodo = `${currentYear}-${String(month).padStart(2, "0")}`;
      await executeQuery(`
        INSERT INTO CUOTA (
          id_casa, concepto, periodo, monto_total,
          fecha_emision, fecha_vencimiento, estado, creado_por
        )
        SELECT :idCasa, :concepto, :periodo, :montoTotal,
               TO_DATE(:periodo || '-01', 'YYYY-MM-DD'),
               LAST_DAY(TO_DATE(:periodo || '-01', 'YYYY-MM-DD')),
               'PENDIENTE', :creadoPor
        FROM dual
        WHERE NOT EXISTS (
          SELECT 1
          FROM CUOTA
          WHERE id_casa = :idCasa
            AND id_multa IS NULL
            AND concepto = :concepto
            AND periodo = :periodo
        )
      `, {
        idCasa: house.ID_CASA,
        concepto: template.CONCEPTO,
        periodo,
        montoTotal: template.MONTO_TOTAL,
        creadoPor: template.CREADO_POR,
      }, { autoCommit: true });
    }
  }
}

async function getAccountStatement(personaId) {
  await ensureMonthlyFees(personaId);
  const result = await executeQuery(`${ACCOUNT_QUERY} ORDER BY fecha_vencimiento DESC`, {
    personaId: Number(personaId),
  });
  return result.rows.map(mapAccount);
}

async function getGeneralStatement({ periodo, desde, hasta, idCasa } = {}) {
  const dateConditions = [];
  const binds = {};

  if (desde) {
    dateConditions.push("cu.fecha_vencimiento >= TO_DATE(:desde, 'YYYY-MM-DD')");
    binds.desde = desde;
  }
  if (hasta) {
    dateConditions.push("cu.fecha_vencimiento < TO_DATE(:hasta, 'YYYY-MM-DD') + 1");
    binds.hasta = hasta;
  }

  const feeFilter = dateConditions.length
    ? dateConditions.join(" AND ")
    : "cu.periodo = NVL(:periodo, TO_CHAR(SYSDATE, 'YYYY-MM'))";
  if (!dateConditions.length) {
    binds.periodo = periodo || null;
  }
  const houseFilter = idCasa ? "AND c.id_casa = :idCasa" : "";
  if (idCasa) binds.idCasa = Number(idCasa);

  const result = await executeQuery(`
    SELECT c.id_casa, c.numero_casa, c.bloque,
           per.nombres || ' ' || per.apellidos AS propietario,
           cu.periodo, cu.monto_total AS cargos,
           NVL((SELECT SUM(p.monto_pagado) FROM PAGO p
                WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO'), 0) AS pagado,
           cu.fecha_vencimiento,
           CASE
             WHEN NVL((SELECT SUM(p.monto_pagado) FROM PAGO p
                      WHERE p.id_cuota = cu.id_cuota AND p.estado = 'VALIDO'), 0) >= cu.monto_total THEN 'AL_DIA'
             WHEN cu.fecha_vencimiento < TRUNC(SYSDATE) THEN 'MOROSO'
             ELSE 'PENDIENTE'
           END AS estado
    FROM CASA c
    JOIN PERSONA per ON per.id_persona = c.id_propietario
    LEFT JOIN CUOTA cu ON cu.id_casa = c.id_casa
      AND ${feeFilter}
    WHERE c.estado <> 'INACTIVA' ${houseFilter}
    ORDER BY c.bloque, c.numero_casa
  `, binds);

  return result.rows.map((row) => ({
    idCasa: row.ID_CASA,
    casa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    propietario: row.PROPIETARIO,
    periodo: row.PERIODO,
    cargos: Number(row.CARGOS || 0),
    pagado: Number(row.PAGADO || 0),
    saldo: Math.max(Number(row.CARGOS || 0) - Number(row.PAGADO || 0), 0),
    fechaVencimiento: row.FECHA_VENCIMIENTO,
    estado: row.ESTADO,
  }));
}

async function getDelinquentHouses() {
  const result = await executeQuery(`
    SELECT id_casa, numero_casa, bloque, responsable,
           cuotas_pendientes, total_adeudado,
           fecha_vencimiento_mas_antigua, dias_mora_maximo
    FROM VW_CASAS_MOROSAS
    ORDER BY dias_mora_maximo DESC, numero_casa
  `);
  return result.rows.map((row) => ({
    idCasa: row.ID_CASA,
    casa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    responsable: row.RESPONSABLE,
    cuotasPendientes: row.CUOTAS_PENDIENTES,
    totalAdeudado: row.TOTAL_ADEUDADO,
    fechaVencimiento: row.FECHA_VENCIMIENTO_MAS_ANTIGUA,
    diasMora: row.DIAS_MORA_MAXIMO,
  }));
}

async function getActiveFines({ desde, hasta, idCasa } = {}) {
  const conditions = ["m.estado IN ('PENDIENTE', 'VENCIDA')"];
  const binds = {};

  if (desde) {
    conditions.push("m.fecha_multa >= TO_DATE(:desde, 'YYYY-MM-DD')");
    binds.desde = desde;
  }
  if (hasta) {
    conditions.push("m.fecha_multa < TO_DATE(:hasta, 'YYYY-MM-DD') + 1");
    binds.hasta = hasta;
  }
  if (idCasa) {
    conditions.push("m.id_casa = :idCasa");
    binds.idCasa = Number(idCasa);
  }

  const result = await executeQuery(`
    SELECT m.id_multa, m.id_casa, c.numero_casa, c.bloque,
           per.nombres || ' ' || per.apellidos AS propietario,
           m.motivo, m.monto, m.fecha_multa, m.fecha_vencimiento, m.estado
    FROM MULTA m
    JOIN CASA c ON c.id_casa = m.id_casa
    JOIN PERSONA per ON per.id_persona = c.id_propietario
    WHERE ${conditions.join(" AND ")}
    ORDER BY m.fecha_multa DESC, m.id_multa DESC
  `, binds);

  return result.rows.map((row) => ({
    idMulta: row.ID_MULTA,
    idCasa: row.ID_CASA,
    casa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    propietario: row.PROPIETARIO,
    motivo: row.MOTIVO,
    monto: Number(row.MONTO || 0),
    fechaMulta: row.FECHA_MULTA,
    fechaVencimiento: row.FECHA_VENCIMIENTO,
    estado: row.ESTADO,
  }));
}

async function createFine({ idCasa, motivo, monto, fechaVencimiento }, userId) {
  const result = await executeQuery(`
    INSERT INTO MULTA (
      id_casa, motivo, monto, fecha_multa, fecha_vencimiento,
      estado, creado_por
    ) VALUES (
      :idCasa, :motivo, :monto, TRUNC(SYSDATE), TO_DATE(:fechaVencimiento, 'YYYY-MM-DD'),
      'PENDIENTE', :userId
    ) RETURNING id_multa INTO :idMultaOut
  `, {
    idCasa: Number(idCasa),
    motivo: motivo.trim(),
    monto: Number(monto),
    fechaVencimiento,
    userId: Number(userId),
    idMultaOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  }, { autoCommit: true });

  return { idMulta: result.outBinds.idMultaOut[0] };
}

async function submitPayment({ idCuota, monto, fechaPago, metodo, referencia, comprobanteUrl }, personaId) {
  const ownership = await executeQuery(`
    SELECT cu.id_cuota
    FROM CUOTA cu
    JOIN CASA c ON c.id_casa = cu.id_casa
    WHERE cu.id_cuota = :idCuota
      AND (c.id_propietario = :personaId OR EXISTS (
        SELECT 1 FROM RESIDENTE r
        WHERE r.id_casa = c.id_casa AND r.id_persona = :personaId AND r.estado = 'ACTIVO'
      ))
  `, { idCuota: Number(idCuota), personaId: Number(personaId) });

  if (ownership.rows.length === 0) {
    const error = new Error("La cuota no pertenece a una casa asociada a su cuenta.");
    error.statusCode = 403;
    error.code = "PAYMENT_NOT_ALLOWED";
    throw error;
  }

  const result = await executeQuery(`
    INSERT INTO PAGO (
      id_cuota, monto_pagado, fecha_pago, metodo_pago,
      referencia, comprobante_url, estado, creado_por
    ) VALUES (
      :idCuota, :monto, :fechaPago, :metodo,
      :referencia, :comprobanteUrl, 'PENDIENTE',
      (SELECT id_usuario FROM USUARIO WHERE id_persona = :personaId)
    ) RETURNING id_pago INTO :idPagoOut
  `, {
    idCuota: Number(idCuota),
    monto: Number(monto),
    fechaPago: new Date(fechaPago),
    metodo,
    referencia: referencia || null,
    comprobanteUrl: comprobanteUrl || null,
    personaId: Number(personaId),
    idPagoOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  }, { autoCommit: true });

  return { idPago: result.outBinds.idPagoOut[0], estado: "PENDIENTE" };
}

async function updatePaymentStatus(idPago, estado, observacion, userId) {
  const result = await executeQuery(`
    UPDATE PAGO
    SET estado = :estado,
        id_usuario_valida = :userId,
        fecha_validacion = SYSDATE,
        observacion_rechazo = :observacion
    WHERE id_pago = :idPago AND estado = 'PENDIENTE'
  `, {
    estado,
    observacion: observacion || null,
    userId: Number(userId),
    idPago: Number(idPago),
  }, { autoCommit: true });

  if (!result.rowsAffected) {
    const error = new Error("El pago no existe o ya fue procesado.");
    error.statusCode = 404;
    error.code = "PAYMENT_NOT_PENDING";
    throw error;
  }
}

async function getPaymentReceipt(idPago, userId) {
  const result = await executeQuery(`
    SELECT p.id_pago, p.monto_pagado, p.fecha_pago, p.metodo_pago,
           p.referencia, p.estado, p.fecha_validacion,
           cu.periodo, cu.concepto, cu.fecha_vencimiento,
           c.numero_casa, c.bloque,
           per.nombres || ' ' || per.apellidos AS propietario
    FROM PAGO p
    JOIN CUOTA cu ON cu.id_cuota = p.id_cuota
    JOIN CASA c ON c.id_casa = cu.id_casa
    JOIN PERSONA per ON per.id_persona = c.id_propietario
    WHERE p.id_pago = :idPago
      AND p.estado = 'VALIDO'
      AND (
        EXISTS (SELECT 1 FROM USUARIO u WHERE u.id_usuario = :userId AND u.id_rol =
          (SELECT id_rol FROM ROL WHERE nombre = 'ADMINISTRADOR'))
        OR EXISTS (SELECT 1 FROM USUARIO u
          JOIN RESIDENTE r ON r.id_persona = u.id_persona
          WHERE u.id_usuario = :userId
            AND r.id_casa = c.id_casa
            AND r.estado = 'ACTIVO')
      )
  `, { idPago: Number(idPago), userId: Number(userId) });

  if (!result.rows.length) {
    const error = new Error("El recibo no existe, no está validado o no está disponible para esta cuenta.");
    error.statusCode = 404;
    error.code = "RECEIPT_NOT_FOUND";
    throw error;
  }

  return result.rows[0];
}

async function getPaymentAttachment(idPago, userId) {
    const result = await executeQuery(`
      SELECT p.comprobante_url, p.id_pago
      FROM PAGO p
      JOIN CUOTA cu ON cu.id_cuota = p.id_cuota
      JOIN CASA c ON c.id_casa = cu.id_casa
      WHERE p.id_pago = :idPago
        AND (
          EXISTS (SELECT 1 FROM USUARIO u JOIN ROL r ON r.id_rol = u.id_rol
                  WHERE u.id_usuario = :userId AND r.nombre = 'ADMINISTRADOR')
          OR EXISTS (SELECT 1 FROM USUARIO u
                     WHERE u.id_usuario = :userId AND u.id_persona = c.id_propietario)
          OR EXISTS (SELECT 1 FROM USUARIO u JOIN RESIDENTE r ON r.id_persona = u.id_persona
                     WHERE u.id_usuario = :userId AND r.id_casa = c.id_casa AND r.estado = 'ACTIVO')
        )
    `, { idPago: Number(idPago), userId: Number(userId) });

    if (!result.rows.length || !result.rows[0].COMPROBANTE_URL) {
      const error = new Error("El comprobante no existe o no está disponible para esta cuenta.");
      error.statusCode = 404;
      error.code = "ATTACHMENT_NOT_FOUND";
      throw error;
    }

    const fileName = path.basename(result.rows[0].COMPROBANTE_URL);
    const storageCandidates = [
      path.resolve(__dirname, "../../../uploads/comprobantes", fileName),
      path.resolve(__dirname, "../../../../uploads/comprobantes", fileName),
    ];
    const filePath = storageCandidates.find((candidate) => fs.existsSync(candidate));
    if (!filePath) {
      const error = new Error("El archivo del comprobante no se encuentra en el almacenamiento.");
      error.statusCode = 404;
      error.code = "ATTACHMENT_FILE_NOT_FOUND";
      throw error;
    }
    return filePath;
}

module.exports = {
  getPendingPayments,
  getAccountStatement,
  getGeneralStatement,
  getDelinquentHouses,
  getActiveFines,
  createFine,
  submitPayment,
  updatePaymentStatus,
  getPaymentReceipt,
  getPaymentAttachment,
};
