/**
 * =============================================================================
 * CAPA DE SERVICIO: GESTIÓN DE CASAS Y EXPEDIENTES FAMILIARES
 * =============================================================================
 * Descripción:
 *   Contiene las consultas SQL transaccionales para consultar, registrar
 *   y actualizar viviendas, así como vincular residentes a cada inmueble.
 * =============================================================================
 */

const { executeQuery } = require("../../config/db");

/**
 * Obtiene el listado consolidado de casas con información de sus propietarios.
 * 
 * @param {object} filters - Opciones de filtrado (estado, bloque).
 * @returns {Promise<Array>} Lista de casas registradas.
 */
async function getAllCasas(filters = {}) {
  // El estado se calcula a partir del censo activo para que el catálogo no
  // dependa de que la columna CASA.estado haya quedado sincronizada.
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
        (SELECT COUNT(*) FROM RESIDENTE r WHERE r.id_casa = c.id_casa AND r.estado = 'ACTIVO') AS total_habitantes
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

  return result.rows.map((row) => ({
    id: row.ID_CASA,
    numeroCasa: row.NUMERO_CASA,
    bloque: row.BLOQUE,
    direccion: row.DIRECCION,
    estado: row.ESTADO,
    totalHabitantes: row.TOTAL_HABITANTES,
    fechaCreacion: row.FECHA_CREACION,
    propietario: {
      id: row.ID_PROPIETARIO,
      nombre: row.PROPIETARIO_NOMBRE,
      telefono: row.PROPIETARIO_TELEFONO,
      correo: row.PROPIETARIO_CORREO,
    },
  }));
}

/**
 * Obtiene el detalle de una casa junto con su expediente de residentes activos.
 * 
 * @param {number} idCasa - ID primario de la casa.
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

  const resultCasa = await executeQuery(queryCasa, { idCasa });

  if (resultCasa.rows.length === 0) {
    const error = new Error("La propiedad consultada no existe.");
    error.statusCode = 404;
    error.code = "CASA_NOT_FOUND";
    throw error;
  }

  const casa = resultCasa.rows[0];

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

  const resultResidentes = await executeQuery(queryResidentes, { idCasa });

  return {
    id: casa.ID_CASA,
    numeroCasa: casa.NUMERO_CASA,
    bloque: casa.BLOQUE,
    direccion: casa.DIRECCION,
    estado: casa.ESTADO,
    totalHabitantes: casa.TOTAL_HABITANTES,
    propietario: {
      id: casa.ID_PROPIETARIO,
      nombre: casa.PROPIETARIO_NOMBRE,
      dpi: casa.DPI,
      telefono: casa.TELEFONO,
      correo: casa.CORREO,
    },
    residentes: resultResidentes.rows.map((res) => ({
      idResidente: res.ID_RESIDENTE,
      idPersona: res.ID_PERSONA,
      nombreCompleto: `${res.NOMBRES} ${res.APELLIDOS}`,
      identificacion: res.DPI || res.IDENTIFICACION_ALTERNATIVA,
      telefono: res.TELEFONO,
      correo: res.CORREO,
      tipoResidente: res.TIPO_RESIDENTE,
      esPrincipal: res.ES_PRINCIPAL === "SI",
      fechaIngreso: res.FECHA_INGRESO,
    })),
  };
}

/**
 * Registra una nueva vivienda asignando un propietario existente.
 * 
 * @param {object} casaData - Datos de la vivienda.
 * @param {number} userId - ID del administrador que registra la casa.
 * @returns {Promise<object>} Identificador de la casa creada.
 */
async function createCasa(casaData, userId) {
  const { numeroCasa, bloque, direccion, idPropietario, estado } = casaData;

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
    numeroCasa: numeroCasa.trim(),
    bloque: bloque.trim(),
    direccion: direccion.trim(),
    idPropietario: idPropietario ? Number(idPropietario) : null,
    estado: estado || "DISPONIBLE",
    userId,
    id_casa_out: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  const newId = result.outBinds.id_casa_out[0];

  return { id: newId, message: "Casa registrada exitosamente." };
}

/**
 * Recalcula y persiste el estado de ocupación de una vivienda a partir de su
 * censo activo. Se invoca después de vincular o desvincular habitantes para
 * que el catálogo y el censo mantengan la misma información.
 *
 * @param {number} idCasa - ID de la vivienda a sincronizar.
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
 * Como la tabla RESIDENTE conserva el histórico (desvinculaciones mediante
 * estado = 'INACTIVO'), si la persona ya tuvo un vínculo previo con la misma
 * casa se reactiva ese registro en lugar de insertar uno nuevo (la restricción
 * uq_persona_casa es única por par persona/casa).
 *
 * @param {number} idCasa - ID de la vivienda.
 * @param {object} residenteData - Datos del habitante y su clasificación.
 */
async function addResidenteToCasa(idCasa, residenteData) {
  const { idPersona, tipoResidente, esPrincipal } = residenteData;

  const tipoFinal = tipoResidente || "FAMILIAR";
  const principalFinal = esPrincipal ? "SI" : "NO";

  // 1. ¿Existe ya un vínculo previo de esta persona con la casa?
  const checkSql = `
    SELECT id_residente, estado
    FROM RESIDENTE
    WHERE id_persona = :idPersona AND id_casa = :idCasa
  `;
  const checkResult = await executeQuery(checkSql, { idPersona, idCasa });

  if (checkResult.rows.length > 0) {
    const existente = checkResult.rows[0];

    if (existente.ESTADO === "ACTIVO") {
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
        idResidente: existente.ID_RESIDENTE,
      },
      { autoCommit: true }
    );

    await sincronizarEstadoCasa(idCasa);

    return {
      id: existente.ID_RESIDENTE,
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
    idPersona,
    idCasa,
    tipoResidente: tipoFinal,
    esPrincipal: principalFinal,
    id_residente_out: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  await sincronizarEstadoCasa(idCasa);

  return { id: result.outBinds.id_residente_out[0], message: "Residente asociado a la vivienda." };
}

/**
 * Desvincula (baja lógica) a un residente de una vivienda.
 *
 * No se elimina el registro para conservar el histórico del censo: se marca
 * estado = 'INACTIVO' y se registra la fecha de salida.
 *
 * @param {number} idCasa - ID de la vivienda.
 * @param {number} idResidente - ID del vínculo RESIDENTE a desactivar.
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
    { idResidente, idCasa },
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
 * Obtiene el listado de personas registradas en Oracle para alimentar los selectores
 */
async function listarPersonas(connection) {
  const sql = `
    SELECT 
      ID_PERSONA as "idPersona",
      NOMBRES as "nombres",
      APELLIDOS as "apellidos",
      NOMBRES || ' ' || APELLIDOS as "nombreCompleto",
      DPI as "dpi",
      TELEFONO as "telefono",
      CORREO as "correo"
    FROM PERSONA
    ORDER BY NOMBRES ASC
  `;
  const result = await connection.execute(sql, [], { outFormat: 4002 }); // 4002 = oracledb.OUT_FORMAT_OBJECT
  return result.rows;
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

  return result.rows.map((row) => ({
    idPersona: row.ID_PERSONA,
    nombres: row.NOMBRES,
    apellidos: row.APELLIDOS,
    nombreCompleto: row.NOMBRE_COMPLETO,
    dpi: row.DPI,
    telefono: row.TELEFONO,
    correo: row.CORREO,
  }));
}

/**
 * Actualiza los datos generales de una vivienda y/o su propietario asignado.
 * 
 * @param {number} idCasa - ID de la casa a actualizar.
 * @param {object} casaData - Campos actualizados de la casa.
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
    numeroCasa: numeroCasa.trim(),
    bloque: bloque.trim(),
    direccion: direccion.trim(),
    estado: estado || "DISPONIBLE",
    idPropietario: idPropietario ? Number(idPropietario) : null,
    idCasa: Number(idCasa),
  };

  await executeQuery(updateSql, binds, { autoCommit: true });
  await sincronizarEstadoCasa(idCasa);

  return { message: "Casa actualizada correctamente." };
}

/**
 * Registra a un nuevo ciudadano en el padrón (tabla PERSONA).
 */
async function createPersona(personaData) {
  const { nombres, apellidos, dpi, telefono, correo } = personaData;

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
    nombres: nombres.trim(),
    apellidos: apellidos.trim(),
    dpi: dpi ? dpi.trim() : null,
    telefono: telefono ? telefono.trim() : null,
    correo: correo ? correo.trim() : null,
    id_persona_out: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  const newId = result.outBinds.id_persona_out[0];

  return {
    idPersona: newId,
    nombreCompleto: `${nombres.trim()} ${apellidos.trim()}`,
    dpi,
    telefono,
    correo,
  };
}

module.exports = {
  getAllCasas,
  getCasaById,
  createCasa,
  addResidenteToCasa,
  removeResidenteFromCasa,
  getPersonas,
  updateCasa,
  createPersona,
};