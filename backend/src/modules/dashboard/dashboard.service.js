/**
 * =============================================================================
 * CAPA DE SERVICIO: DASHBOARD ESTRATÉGICO DEL ADMINISTRADOR
 * =============================================================================
 * Descripción:
 *   Consultas agregadas (solo lectura) sobre las tablas ya operativas de
 *   Casas, Finanzas, Visitas, Comunicaciones/Quejas y Garita/Accesos para
 *   construir el JSON consolidado que consume el panel ejecutivo.
 *
 * Reglas:
 *   - Ninguna función de este archivo escribe en la base de datos.
 *   - Las consultas se disparan en paralelo con Promise.all para minimizar
 *     el tiempo de respuesta del endpoint GET /api/dashboard/admin.
 *   - Los nombres de tabla/columna se confirmaron en database/ddl/01_schema.sql
 *     y en las migraciones 05 y 06.
 * =============================================================================
 */

const { executeQuery } = require("../../config/db");

/** Cantidad máxima de ítems por lista de la bandeja de pendientes. */
const LIMITE_PENDIENTES = 5;

/**
 * Normaliza una fila cruda de Oracle a claves en minúsculas para que el
 * mapeo no dependa del caso de los alias devueltos por oracledb.
 *
 * @param {object} fila Fila devuelta por la consulta.
 * @returns {object} Copia de la fila con claves en minúsculas.
 */
function normalizarFila(fila = {}) {
  const salida = {};
  Object.entries(fila).forEach(([clave, valor]) => {
    salida[String(clave).toLowerCase()] = valor;
  });
  return salida;
}

/** Primera fila del resultado (o una fila vacía). */
function primeraFila(resultado) {
  const filas = resultado?.rows || resultado?.data || resultado || [];
  return normalizarFila(filas[0] || {});
}

/** Todas las filas del resultado. */
function todasLasFilas(resultado) {
  return (resultado?.rows || resultado?.data || resultado || []).map(normalizarFila);
}

/** Conversión segura a número (Oracle puede devolver null en SUM/COUNT). */
function aNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

/** Porcentaje con un decimal, evitando divisiones entre cero. */
function aPorcentaje(parte, total) {
  if (!total || total <= 0) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

/**
 * 1. VIVIENDAS: total de casas, desglose por estado y residentes activos.
 *
 * El estado se deriva con la misma regla del catálogo de casas (la columna
 * CASA.estado puede quedar desfasada): INACTIVA gana siempre; después,
 * cualquier residente ACTIVO convierte la casa en OCUPADA.
 */
const SQL_VIVIENDAS = `
  SELECT
    resumen.total_casas,
    resumen.ocupadas,
    resumen.disponibles,
    resumen.inactivas,
    (SELECT COUNT(*) FROM RESIDENTE WHERE estado = 'ACTIVO') AS residentes_activos
  FROM (
    SELECT
      COUNT(*) AS total_casas,
      NVL(SUM(CASE WHEN estado_calc = 'OCUPADA' THEN 1 ELSE 0 END), 0) AS ocupadas,
      NVL(SUM(CASE WHEN estado_calc = 'DISPONIBLE' THEN 1 ELSE 0 END), 0) AS disponibles,
      NVL(SUM(CASE WHEN estado_calc = 'INACTIVA' THEN 1 ELSE 0 END), 0) AS inactivas
    FROM (
      SELECT
        CASE
          WHEN c.estado = 'INACTIVA' THEN 'INACTIVA'
          WHEN EXISTS (
            SELECT 1
            FROM RESIDENTE r
            WHERE r.id_casa = c.id_casa
              AND r.estado = 'ACTIVO'
          ) THEN 'OCUPADA'
          ELSE 'DISPONIBLE'
        END AS estado_calc
      FROM CASA c
    )
  ) resumen
`;

/**
 * 2. FINANZAS (MES ACTUAL): recaudación del mes en curso y pagos reportados
 *    que aún esperan validación por parte de administración.
 */
const SQL_RECAUDACION_MES = `
  SELECT
    NVL(SUM(CASE
      WHEN p.estado = 'VALIDO'
       AND p.fecha_pago >= TRUNC(SYSDATE, 'MM')
       AND p.fecha_pago < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      THEN p.monto_pagado
    END), 0) AS recaudado_mes,
    COUNT(CASE
      WHEN p.estado = 'VALIDO'
       AND p.fecha_pago >= TRUNC(SYSDATE, 'MM')
       AND p.fecha_pago < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      THEN 1
    END) AS pagos_validados_mes,
    NVL(SUM(CASE
      WHEN p.estado = 'PENDIENTE'
       AND p.fecha_pago >= TRUNC(SYSDATE, 'MM')
       AND p.fecha_pago < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      THEN p.monto_pagado
    END), 0) AS monto_por_validar,
    COUNT(CASE
      WHEN p.estado = 'PENDIENTE'
       AND p.fecha_pago >= TRUNC(SYSDATE, 'MM')
       AND p.fecha_pago < ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)
      THEN 1
    END) AS pagos_por_validar,
    TO_CHAR(SYSDATE, 'YYYY-MM') AS periodo
  FROM PAGO p
`;

/**
 * 2b. FINANZAS (CUOTAS DEL PERÍODO): cuotas emitidas y pagadas del mes en
 *     curso (excluye cuotas anuladas). Alimenta el % de cumplimiento y el
 *     % de cobranza del período.
 */
const SQL_CUOTAS_PERIODO = `
  SELECT
    TO_CHAR(SYSDATE, 'YYYY-MM') AS periodo,
    COUNT(*) AS cuotas_emitidas,
    NVL(SUM(CASE WHEN pagado >= monto_total THEN 1 ELSE 0 END), 0) AS cuotas_pagadas,
    NVL(SUM(monto_total), 0) AS monto_emitido,
    NVL(SUM(CASE WHEN pagado < monto_total THEN monto_total - pagado END), 0) AS monto_pendiente
  FROM (
    SELECT
      cu.monto_total,
      NVL((
        SELECT SUM(p.monto_pagado)
        FROM PAGO p
        WHERE p.id_cuota = cu.id_cuota
          AND p.estado = 'VALIDO'
      ), 0) AS pagado
    FROM CUOTA cu
    WHERE cu.periodo = TO_CHAR(SYSDATE, 'YYYY-MM')
      AND cu.estado <> 'ANULADA'
  )
`;

/**
 * 2c. MOROSIDAD GLOBAL: cuotas con saldo pendiente de cualquier período,
 *     separando las ya vencidas. Alimenta la alerta de morosidad.
 */
const SQL_MOROSIDAD = `
  SELECT
    COUNT(*) AS cuotas_pendientes,
    NVL(SUM(CASE WHEN fecha_vencimiento < TRUNC(SYSDATE) THEN 1 ELSE 0 END), 0) AS cuotas_vencidas,
    NVL(SUM(saldo), 0) AS monto_pendiente,
    NVL(SUM(CASE WHEN fecha_vencimiento < TRUNC(SYSDATE) THEN saldo END), 0) AS monto_vencido
  FROM (
    SELECT
      cu.fecha_vencimiento,
      GREATEST(
        cu.monto_total - NVL((
          SELECT SUM(p.monto_pagado)
          FROM PAGO p
          WHERE p.id_cuota = cu.id_cuota
            AND p.estado = 'VALIDO'
        ), 0),
        0
      ) AS saldo
    FROM CUOTA cu
    WHERE cu.estado <> 'ANULADA'
  )
  WHERE saldo > 0
`;

/**
 * 3. OPERACIÓN Y SEGURIDAD: visitas dentro del condominio en este momento y
 *    visitas programadas para hoy (AUTORIZADA / PENDIENTE).
 */
const SQL_OPERACION_VISITAS = `
  SELECT
    COUNT(CASE WHEN estado = 'DENTRO' THEN 1 END) AS visitas_dentro,
    COUNT(CASE WHEN fecha_esperada = TRUNC(SYSDATE) AND estado = 'AUTORIZADA' THEN 1 END) AS autorizadas_hoy,
    COUNT(CASE WHEN fecha_esperada = TRUNC(SYSDATE) AND estado = 'PENDIENTE' THEN 1 END) AS pendientes_hoy
  FROM VISITA
  WHERE estado = 'DENTRO'
     OR (fecha_esperada = TRUNC(SYSDATE) AND estado IN ('AUTORIZADA', 'PENDIENTE'))
`;

/** 3b. Proveedores y servicios externos vigentes hoy. */
const SQL_SERVICIOS_VIGENTES = `
  SELECT COUNT(*) AS servicios_vigentes
  FROM SERVICIO_EXTERNO
  WHERE estado = 'ACTIVO'
    AND fecha_inicio <= TRUNC(SYSDATE)
    AND fecha_fin >= TRUNC(SYSDATE)
`;

/** 3c. Movimientos de garita registrados hoy (tabla ACCESO). */
const SQL_ACCESOS_HOY = `
  SELECT
    COUNT(CASE WHEN tipo_movimiento = 'ENTRADA' THEN 1 END) AS entradas_hoy,
    COUNT(CASE WHEN tipo_movimiento = 'SALIDA' THEN 1 END) AS salidas_hoy
  FROM ACCESO
  WHERE fecha_hora >= TRUNC(SYSDATE)
`;

/**
 * 4. BANDEJA: eventos masivos en PENDIENTE_APROBACION (los 5 más recientes
 *    y el total con la analítica COUNT(*) OVER()).
 */
const SQL_EVENTOS_PENDIENTES = `
  SELECT
    e.id_evento,
    e.nombre_evento,
    TO_CHAR(e.fecha_evento, 'YYYY-MM-DD') AS fecha_evento,
    e.salon_asignado,
    TO_CHAR(e.fecha_solicitud, 'DD/MM/YYYY HH24:MI') AS fecha_solicitud,
    c.numero_casa,
    COALESCE(
      p.nombres || ' ' || p.apellidos,
      u.nombre_usuario,
      'Sin solicitante'
    ) AS solicitante,
    COUNT(*) OVER() AS total_eventos
  FROM EVENTO_VISITA e
  LEFT JOIN CASA c ON c.id_casa = e.id_casa
  LEFT JOIN USUARIO u ON u.id_usuario = e.solicitado_por
  LEFT JOIN PERSONA p ON p.id_persona = u.id_persona
  WHERE e.estado_aprobacion = 'PENDIENTE_APROBACION'
  ORDER BY e.fecha_solicitud DESC
  FETCH FIRST ${LIMITE_PENDIENTES} ROWS ONLY
`;

/**
 * 4b. BANDEJA: quejas/sugerencias activas (PENDIENTE / EN_PROCESO) o todavía
 *     sin respuesta (las 5 más recientes y el total).
 */
const SQL_QUEJAS_PENDIENTES = `
  SELECT
    q.id_queja,
    q.asunto,
    q.estado,
    TO_CHAR(q.fecha_creacion, 'DD/MM/YYYY') AS fecha_creacion,
    CASE WHEN q.respuesta IS NULL THEN 'SI' ELSE 'NO' END AS sin_respuesta,
    c.numero_casa,
    COALESCE(
      p.nombres || ' ' || p.apellidos,
      u.nombre_usuario,
      'Sin remitente'
    ) AS remitente,
    COUNT(*) OVER() AS total_quejas
  FROM QUEJA q
  LEFT JOIN CASA c ON c.id_casa = q.id_casa
  LEFT JOIN USUARIO u ON u.id_usuario = q.id_usuario
  LEFT JOIN PERSONA p ON p.id_persona = u.id_persona
  WHERE q.estado IN ('PENDIENTE', 'EN_PROCESO')
     OR (q.respuesta IS NULL AND q.estado NOT IN ('RESUELTA', 'RECHAZADA'))
  ORDER BY q.fecha_creacion DESC, q.id_queja DESC
  FETCH FIRST ${LIMITE_PENDIENTES} ROWS ONLY
`;

/**
 * Construye el JSON consolidado del dashboard administrativo.
 *
 * @returns {Promise<object>} Métricas de viviendas, finanzas, operación y
 *                            bandeja de pendientes.
 */
async function getAdminDashboard() {
  const [
    resultadoViviendas,
    resultadoRecaudacion,
    resultadoCuotas,
    resultadoMorosidad,
    resultadoVisitas,
    resultadoServicios,
    resultadoAccesos,
    resultadoEventos,
    resultadoQuejas,
  ] = await Promise.all([
    executeQuery(SQL_VIVIENDAS, {}),
    executeQuery(SQL_RECAUDACION_MES, {}),
    executeQuery(SQL_CUOTAS_PERIODO, {}),
    executeQuery(SQL_MOROSIDAD, {}),
    executeQuery(SQL_OPERACION_VISITAS, {}),
    executeQuery(SQL_SERVICIOS_VIGENTES, {}),
    executeQuery(SQL_ACCESOS_HOY, {}),
    executeQuery(SQL_EVENTOS_PENDIENTES, {}),
    executeQuery(SQL_QUEJAS_PENDIENTES, {}),
  ]);

  // ---------------------------------------------------------------- Viviendas
  const filaViviendas = primeraFila(resultadoViviendas);
  const totalCasas = aNumero(filaViviendas.total_casas);
  const casasOcupadas = aNumero(filaViviendas.ocupadas);

  const viviendas = {
    totalCasas,
    ocupadas: casasOcupadas,
    disponibles: aNumero(filaViviendas.disponibles),
    inactivas: aNumero(filaViviendas.inactivas),
    residentesActivos: aNumero(filaViviendas.residentes_activos),
    porcentajeOcupacion: aPorcentaje(casasOcupadas, totalCasas),
  };

  // ----------------------------------------------------------------- Finanzas
  const filaRecaudacion = primeraFila(resultadoRecaudacion);
  const filaCuotas = primeraFila(resultadoCuotas);
  const filaMorosidad = primeraFila(resultadoMorosidad);
  const periodo = filaCuotas.periodo || filaRecaudacion.periodo || null;

  const cuotasEmitidas = aNumero(filaCuotas.cuotas_emitidas);
  const cuotasPagadas = aNumero(filaCuotas.cuotas_pagadas);
  const montoEmitido = aNumero(filaCuotas.monto_emitido);
  const montoRecaudadoPeriodo = Math.max(
    montoEmitido - aNumero(filaCuotas.monto_pendiente),
    0
  );

  const finanzas = {
    periodo,
    // --- Mes en curso: efectivo efectivamente cobrado ---
    recaudadoMes: aNumero(filaRecaudacion.recaudado_mes),
    pagosValidadosMes: aNumero(filaRecaudacion.pagos_validados_mes),
    montoPorValidar: aNumero(filaRecaudacion.monto_por_validar),
    pagosPorValidar: aNumero(filaRecaudacion.pagos_por_validar),
    // --- Período en curso: cuotas emitidas y su cumplimiento ---
    cuotasEmitidas,
    cuotasPagadas,
    montoEmitido,
    montoRecaudadoPeriodo,
    // Cumplimiento = cuotas del período pagadas / cuotas emitidas.
    porcentajeCumplimiento: aPorcentaje(cuotasPagadas, cuotasEmitidas),
    // Cobranza = monto efectivamente pagado del período / monto emitido.
    porcentajeCobranza: aPorcentaje(montoRecaudadoPeriodo, montoEmitido),
    // --- Morosidad global: saldos de cualquier período aún no cancelados ---
    cuotasPendientes: aNumero(filaMorosidad.cuotas_pendientes),
    cuotasVencidas: aNumero(filaMorosidad.cuotas_vencidas),
    montoPendiente: aNumero(filaMorosidad.monto_pendiente),
    montoVencido: aNumero(filaMorosidad.monto_vencido),
  };

  // ------------------------------------------- Operación y seguridad en vivo
  const filaVisitas = primeraFila(resultadoVisitas);
  const filaServicios = primeraFila(resultadoServicios);
  const filaAccesos = primeraFila(resultadoAccesos);

  const autorizadasHoy = aNumero(filaVisitas.autorizadas_hoy);
  const pendientesHoy = aNumero(filaVisitas.pendientes_hoy);
  const visitasEsperadasHoy = autorizadasHoy + pendientesHoy;

  const operacion = {
    visitasDentro: aNumero(filaVisitas.visitas_dentro),
    autorizadasHoy,
    pendientesHoy,
    visitasEsperadasHoy,
    ingresosEsperadosHoy: visitasEsperadasHoy,
    serviciosVigentes: aNumero(filaServicios.servicios_vigentes),
    entradasHoy: aNumero(filaAccesos.entradas_hoy),
    salidasHoy: aNumero(filaAccesos.salidas_hoy),
  };

  // ------------------------------------------------- Bandeja de pendientes
  const filasEventos = todasLasFilas(resultadoEventos);
  const filasQuejas = todasLasFilas(resultadoQuejas);

  const eventos = filasEventos.map((fila) => ({
    idEvento: aNumero(fila.id_evento),
    nombreEvento: fila.nombre_evento || "Evento sin nombre",
    fechaEvento: fila.fecha_evento || null,
    salonAsignado: fila.salon_asignado || null,
    fechaSolicitud: fila.fecha_solicitud || null,
    numeroCasa: fila.numero_casa || null,
    solicitante: fila.solicitante || "Sin solicitante",
  }));

  const quejas = filasQuejas.map((fila) => ({
    idQueja: aNumero(fila.id_queja),
    asunto: fila.asunto || "Sin asunto",
    estado: fila.estado || "PENDIENTE",
    fechaCreacion: fila.fecha_creacion || null,
    sinRespuesta: fila.sin_respuesta === "SI",
    numeroCasa: fila.numero_casa || null,
    remitente: fila.remitente || "Sin remitente",
  }));

  const totalEventos = eventos.length > 0
    ? aNumero(filasEventos[0].total_eventos)
    : 0;
  const totalQuejas = quejas.length > 0
    ? aNumero(filasQuejas[0].total_quejas)
    : 0;

  const pendientes = {
    total: totalEventos + totalQuejas,
    totalEventos,
    totalQuejas,
    eventos,
    quejas,
  };

  return {
    generadoEn: new Date().toISOString(),
    periodo,
    viviendas,
    finanzas,
    operacion,
    pendientes,
  };
}

module.exports = {
  getAdminDashboard,
};
