/**
 * =============================================================================
 * CAPA DE SERVICIO: GESTIÓN DE CASAS Y EXPEDIENTES FAMILIARES DE CONDÓMINOS
 * =============================================================================
 * Descripción:
 *   Consultas SQL transaccionales para consultar, registrar y actualizar 
 *   viviendas, vinculando residentes/condóminos a sus inmuebles de Oracle DB.
 * =============================================================================
 */

const { executeQuery } = require("../../config/db");

async function getCasasParaGarita() {
  const query = `
    SELECT id_casa, numero_casa, bloque
    FROM CASA
    WHERE estado <> 'INACTIVA'
    ORDER BY bloque ASC, numero_casa ASC
  `;
  const result = await executeQuery(query, {});
  const rows = result.rows || result.data || result || [];

  return rows.map((row) => ({
    id: row.ID_CASA ?? row.id_casa,
    id_casa: row.ID_CASA ?? row.id_casa,
    numeroCasa: row.NUMERO_CASA ?? row.numero_casa,
    numero_casa: row.NUMERO_CASA ?? row.numero_casa,
    bloque: row.BLOQUE ?? row.bloque,
  }));
}

/**
 * Obtiene el listado consolidado de casas con información de propietarios y residentes.
 * 
 * @param {object} filters Opciones de filtrado (estado, bloque).
 * @returns {Promise<Array>} Lista de casas con condóminos asociados.
 */
async function getAllCasas(filters = {}) {
  let query = `
    WITH casas_estado AS (
      SELECT
        c.id_casa,
        c.numero_casa,
        c.bloque,
        c.direccion,
        CASE
          WHEN c.estado = 'INACTIVA' THEN 'INACTIVA'
          WHEN (SELECT COUNT(*) FROM RESIDENTE r WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO') > 0
            THEN 'OCUPADA'
          ELSE 'DISPONIBLE'
        END AS estado,
        c.fecha_creacion,
        p.id_persona AS id_propietario,
        p.nombres || ' ' || p.apellidos AS propietario_nombre,
        p.telefono AS propietario_telefono,
        p.correo AS propietario_correo,
        (SELECT COUNT(*) FROM RESIDENTE r WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO') AS total_habitantes,
        (
          SELECT r.id_residente 
          FROM RESIDENTE r 
          WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO' AND ROWNUM = 1
        ) AS id_residente_principal
      FROM CASA c
      JOIN PERSONA p ON c.id_propietario = p.id_persona
    )
    SELECT * FROM casas_estado
    WHERE 1=1
  `;

  const binds = {};

  if (filters.estado) {
    query += ` AND estado = :estado`;
    binds.estado = filters.estado;
  }

  if (filters.bloque) {
    query += ` AND UPPER(bloque) = UPPER(:bloque)`;
    binds.bloque = filters.bloque;
  }

  query += ` ORDER BY bloque ASC, numero_casa ASC`;

  const result = await executeQuery(query, binds);
  const rows = result.rows || result.data || result || [];

  return rows.map((row) => {
    const idCasa = row.ID_CASA ?? row.id_casa;
    const numeroCasa = row.NUMERO_CASA ?? row.numero_casa;
    const bloque = row.BLOQUE ?? row.bloque;
    const direccion = row.DIRECCION ?? row.direccion;
    const estado = row.ESTADO ?? row.estado;
    const totalHabitantes = row.TOTAL_HABITANTES ?? row.total_habitantes ?? 0;
    const fechaCreacion = row.FECHA_CREACION ?? row.fecha_creacion;
    const idPropietario = row.ID_PROPIETARIO ?? row.id_propietario;
    const propietarioNombre = row.PROPIETARIO_NOMBRE ?? row.propietario_nombre ?? "Propietario Sin Nombre";
    const propietarioTelefono = row.PROPIETARIO_TELEFONO ?? row.propietario_telefono;
    const propietarioCorreo = row.PROPIETARIO_CORREO ?? row.propietario_correo;
    const idResidentePrincipal = row.ID_RESIDENTE_PRINCIPAL ?? row.id_residente_principal;

    return {
      id: idCasa,
      id_casa: idCasa,
      ID_CASA: idCasa,
      numeroCasa: numeroCasa,
      numero_casa: numeroCasa,
      NUMERO_CASA: numeroCasa,
      bloque: bloque,
      BLOQUE: bloque,
      direccion: direccion,
      DIRECCION: direccion,
      estado: estado,
      ESTADO: estado,
      totalHabitantes: totalHabitantes,
      id_residente: idResidentePrincipal,
      ID_RESIDENTE: idResidentePrincipal,
      nombre_condomino: propietarioNombre,
      NOMBRE_CONDOMINO: propietarioNombre,
      fechaCreacion: fechaCreacion,
      propietario: {
        id: idPropietario,
        id_propietario: idPropietario,
        nombre: propietarioNombre,
        telefono: propietarioTelefono,
        correo: propietarioCorreo,
      },
    };
  });
}

/**
 * Obtiene el detalle de una casa junto con su expediente de residentes activos.
 * 
 * @param {number} idCasa ID primario de la casa.
 * @returns {Promise<object>} Detalle de la casa y lista de sus habitantes.
 */
async function getCasaById(idCasa) {
  const queryCasa = `
    SELECT 
      c.id_casa,
      c.numero_casa,
      c.bloque,
      c.direccion,
      CASE
        WHEN c.estado = 'INACTIVA' THEN 'INACTIVA'
        WHEN (SELECT COUNT(*) FROM RESIDENTE r WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO') > 0
          THEN 'OCUPADA'
        ELSE 'DISPONIBLE'
      END AS estado,
      (SELECT COUNT(*) FROM RESIDENTE r WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO') AS total_habitantes,
      p.id_persona AS id_propietario,
      p.nombres || ' ' || p.apellidos AS propietario_nombre,
      p.telefono,
      p.correo,
      p.dpi
    FROM CASA c
    JOIN PERSONA p ON c.id_propietario = p.id_persona
    WHERE c.id_casa = :idCasa
  `;

  const resultCasa = await executeQuery(queryCasa, { idCasa: Number(idCasa) });
  const rowsCasa = resultCasa.rows || resultCasa.data || resultCasa || [];

  if (rowsCasa.length === 0) {
    const error = new Error("La propiedad consultada no existe.");
    error.statusCode = 404;
    error.code = "CASA_NOT_FOUND";
    throw error;
  }

  const casa = rowsCasa[0];

  // Consulta de los miembros del núcleo familiar o inquilinos vinculados
  const queryResidentes = `
    SELECT 
      r.id_residente,
      r.tipo_residente,
      r.es_principal,
      r.fecha_ingreso,
      p.id_persona,
      p.nombres,
      p.apellidos,
      p.dpi,
      p.identificacion_alternativa,
      p.telefono,
      p.correo
    FROM RESIDENTE r
    JOIN PERSONA p ON r.id_persona = p.id_persona
    WHERE r.id_casa = :idCasa AND r.estado = 'ACTIVO'
    ORDER BY r.es_principal DESC, p.apellidos ASC
  `;

  const resultResidentes = await executeQuery(queryResidentes, { idCasa: Number(idCasa) });
  const rowsRes = resultResidentes.rows || resultResidentes.data || resultResidentes || [];

  return {
    id: casa.ID_CASA ?? casa.id_casa,
    id_casa: casa.ID_CASA ?? casa.id_casa,
    numeroCasa: casa.NUMERO_CASA ?? casa.numero_casa,
    bloque: casa.BLOQUE ?? casa.bloque,
    direccion: casa.DIRECCION ?? casa.direccion,
    estado: casa.ESTADO ?? casa.estado,
    totalHabitantes: casa.TOTAL_HABITANTES ?? casa.total_habitantes ?? 0,
    propietario: {
      id: casa.ID_PROPIETARIO ?? casa.id_propietario,
      nombre: casa.PROPIETARIO_NOMBRE ?? casa.propietario_nombre,
      dpi: casa.DPI ?? casa.dpi,
      telefono: casa.TELEFONO ?? casa.telefono,
      correo: casa.CORREO ?? casa.correo,
    },
    residentes: rowsRes.map((res) => ({
      idResidente: res.ID_RESIDENTE ?? res.id_residente,
      id_residente: res.ID_RESIDENTE ?? res.id_residente,
      idPersona: res.ID_PERSONA ?? res.id_persona,
      nombreCompleto: `${res.NOMBRES ?? res.nombres ?? ""} ${res.APELLIDOS ?? res.apellidos ?? ""}`.trim(),
      identificacion: res.DPI || res.dpi || res.IDENTIFICACION_ALTERNATIVA || res.identificacion_alternativa,
      telefono: res.TELEFONO ?? res.telefono,
      correo: res.CORREO ?? res.correo,
      tipoResidente: res.TIPO_RESIDENTE ?? res.tipo_residente,
      esPrincipal: (res.ES_PRINCIPAL ?? res.es_principal) === "SI",
      fechaIngreso: res.FECHA_INGRESO ?? res.fecha_ingreso,
    })),
  };
}

/**
 * Registra una nueva vivienda asignando un propietario existente.
 * 
 * @param {object} casaData Datos de la vivienda.
 * @param {number} userId ID del usuario que registra la casa.
 * @returns {Promise<object>} Identificador de la casa creada.
 */
async function createCasa(casaData, userId) {
  const { numeroCasa, bloque, direccion, idPropietario, estado } = casaData;
  const oracledb = require("oracledb");

  const insertSql = `
    INSERT INTO CASA (
      numero_casa,
      bloque,
      direccion,
      id_propietario,
      estado,
      creado_por
    ) VALUES (
      :numeroCasa,
      UPPER(:bloque),
      :direccion,
      :idPropietario,
      :estado,
      :userId
    ) RETURNING id_casa INTO :id_casa_out
  `;

  const binds = {
    numeroCasa: String(numeroCasa).trim(),
    bloque: String(bloque).trim(),
    direccion: String(direccion).trim(),
    idPropietario: idPropietario ? Number(idPropietario) : null,
    estado: estado || "DISPONIBLE",
    userId: userId ? Number(userId) : null,
    id_casa_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  const newId = result.outBinds.id_casa_out[0];

  return { id: newId, message: "Casa registrada exitosamente." };
}

/**
 * Recalcula y persiste el estado de ocupación de una vivienda a partir de su censo activo.
 *
 * @param {number} idCasa ID de la vivienda a sincronizar.
 */
async function sincronizarEstadoCasa(idCasa) {
  const updateSql = `
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
    WHERE c.id_casa = :idCasa
  `;

  await executeQuery(updateSql, { idCasa: Number(idCasa) }, { autoCommit: true });
}

/**
 * Asocia un residente físico (familiar o inquilino) a una vivienda.
 *
 * @param {number} idCasa ID de la vivienda.
 * @param {object} residenteData Datos del habitante y su clasificación.
 */
async function addResidenteToCasa(idCasa, residenteData) {
  const { idPersona, tipoResidente, esPrincipal } = residenteData;
  const oracledb = require("oracledb");

  const tipoFinal = tipoResidente || "FAMILIAR";
  const principalFinal = esPrincipal ? "SI" : "NO";

  // 1. ¿Existe ya un vínculo previo de esta persona con la casa?
  const checkSql = `
    SELECT id_residente, estado
    FROM RESIDENTE
    WHERE id_persona = :idPersona AND id_casa = :idCasa
  `;
  const checkResult = await executeQuery(checkSql, {
    idPersona: Number(idPersona),
    idCasa: Number(idCasa),
  });

  const rowsCheck = checkResult.rows || checkResult.data || checkResult || [];

  if (rowsCheck.length > 0) {
    const existente = rowsCheck[0];
    const estadoExistente = existente.ESTADO ?? existente.estado;
    const idResidenteExistente = existente.ID_RESIDENTE ?? existente.id_residente;

    if (estadoExistente === "ACTIVO") {
      const error = new Error("La persona ya se encuentra vinculada a esta vivienda.");
      error.statusCode = 409;
      error.code = "RESIDENT_ALREADY_LINKED";
      throw error;
    }

    // Reactivación de un vínculo previamente desvinculado
    const reactivarSql = `
      UPDATE RESIDENTE
      SET tipo_residente = :tipoResidente,
          es_principal = :esPrincipal,
          estado = 'ACTIVO',
          fecha_ingreso = SYSDATE,
          fecha_salida = NULL
      WHERE id_residente = :idResidente
    `;
    await executeQuery(
      reactivarSql,
      {
        tipoResidente: tipoFinal,
        esPrincipal: principalFinal,
        idResidente: Number(idResidenteExistente),
      },
      { autoCommit: true }
    );

    await sincronizarEstadoCasa(idCasa);

    return {
      id: idResidenteExistente,
      message: "Residente reconectado a la vivienda.",
    };
  }

  // 2. Inserción de un vínculo nuevo
  const insertSql = `
    INSERT INTO RESIDENTE (
      id_persona,
      id_casa,
      tipo_residente,
      es_principal,
      estado
    ) VALUES (
      :idPersona,
      :idCasa,
      :tipoResidente,
      :esPrincipal,
      'ACTIVO'
    ) RETURNING id_residente INTO :id_residente_out
  `;

  const binds = {
    idPersona: Number(idPersona),
    idCasa: Number(idCasa),
    tipoResidente: tipoFinal,
    esPrincipal: principalFinal,
    id_residente_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  await sincronizarEstadoCasa(idCasa);

  return { id: result.outBinds.id_residente_out[0], message: "Residente asociado a la vivienda." };
}

/**
 * Desvincula (baja lógica) a un residente de una vivienda.
 *
 * @param {number} idCasa ID de la vivienda.
 * @param {number} idResidente ID del vínculo RESIDENTE a desactivar.
 * @returns {Promise<{message: string}>}
 */
async function removeResidenteFromCasa(idCasa, idResidente) {
  const updateSql = `
    UPDATE RESIDENTE
    SET estado = 'INACTIVO',
        fecha_salida = SYSDATE
    WHERE id_residente = :idResidente
      AND id_casa = :idCasa
      AND estado = 'ACTIVO'
  `;

  const result = await executeQuery(
    updateSql,
    { idResidente: Number(idResidente), idCasa: Number(idCasa) },
    { autoCommit: true }
  );

  if (!result.rowsAffected || result.rowsAffected === 0) {
    const error = new Error("El residente no existe en esta vivienda o ya fue desvinculado.");
    error.statusCode = 404;
    error.code = "RESIDENT_NOT_FOUND";
    throw error;
  }

  await sincronizarEstadoCasa(idCasa);

  return { message: "Residente desvinculado de la vivienda correctamente." };
}

/**
 * Obtiene el listado de personas registradas para poblar selectores de propietarios y censo.
 * 
 * @returns {Promise<Array>} Lista de personas con nombres y documento.
 */
async function getPersonas() {
  const query = `
    SELECT 
      id_persona,
      nombres,
      apellidos,
      nombres || ' ' || apellidos AS nombre_completo,
      dpi,
      telefono,
      correo
    FROM PERSONA
    ORDER BY nombres ASC, apellidos ASC
  `;

  const result = await executeQuery(query, {});
  const rows = result.rows || result.data || result || [];

  return rows.map((row) => {
    const idPersona = row.ID_PERSONA ?? row.id_persona;
    const nombres = row.NOMBRES ?? row.nombres;
    const apellidos = row.APELLIDOS ?? row.apellidos;
    const nombreCompleto = row.NOMBRE_COMPLETO ?? row.nombre_completo ?? `${nombres} ${apellidos}`.trim();
    const dpi = row.DPI ?? row.dpi;
    const telefono = row.TELEFONO ?? row.telefono;
    const correo = row.CORREO ?? row.correo;

    return {
      idPersona,
      id_persona: idPersona,
      ID_PERSONA: idPersona,
      nombres,
      apellidos,
      nombreCompleto,
      nombre_completo: nombreCompleto,
      dpi,
      telefono,
      correo,
    };
  });
}

/**
 * Actualiza los datos generales de una vivienda y/o su propietario asignado.
 * 
 * @param {number} idCasa ID de la casa a actualizar.
 * @param {object} casaData Campos actualizados de la casa.
 * @returns {Promise<object>} Confirmación de la actualización.
 */
async function updateCasa(idCasa, casaData) {
  const { numeroCasa, bloque, direccion, estado, idPropietario } = casaData;

  const updateSql = `
    UPDATE CASA
    SET 
      numero_casa = :numeroCasa,
      bloque = UPPER(:bloque),
      direccion = :direccion,
      estado = :estado,
      id_propietario = :idPropietario
    WHERE id_casa = :idCasa
  `;

  const binds = {
    numeroCasa: String(numeroCasa).trim(),
    bloque: String(bloque).trim(),
    direccion: String(direccion).trim(),
    estado: estado || "DISPONIBLE",
    idPropietario: idPropietario ? Number(idPropietario) : null,
    idCasa: Number(idCasa),
  };

  await executeQuery(updateSql, binds, { autoCommit: true });
  await sincronizarEstadoCasa(idCasa);

  return { message: "Casa actualizada correctamente." };
}

/**
 * Registra a una nueva persona en la tabla PERSONA.
 */
async function createPersona(personaData) {
  const { nombres, apellidos, dpi, telefono, correo } = personaData;
  const oracledb = require("oracledb");

  const insertSql = `
    INSERT INTO PERSONA (
      nombres,
      apellidos,
      dpi,
      telefono,
      correo
    ) VALUES (
      :nombres,
      :apellidos,
      :dpi,
      :telefono,
      :correo
    ) RETURNING id_persona INTO :id_persona_out
  `;

  const binds = {
    nombres: String(nombres).trim(),
    apellidos: String(apellidos).trim(),
    dpi: dpi ? String(dpi).trim() : null,
    telefono: telefono ? String(telefono).trim() : null,
    correo: correo ? String(correo).trim() : null,
    id_persona_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  const newId = result.outBinds.id_persona_out[0];

  return {
    idPersona: newId,
    id_persona: newId,
    nombreCompleto: `${nombres.trim()} ${apellidos.trim()}`,
    dpi,
    telefono,
    correo,
  };
}

module.exports = {
  getCasasParaGarita,
  getAllCasas,
  getCasaById,
  createCasa,
  addResidenteToCasa,
  removeResidenteFromCasa,
  getPersonas,
  updateCasa,
  createPersona,
};