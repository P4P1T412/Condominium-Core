/**
 * =============================================================================
 * CAPA DE SERVICIO: GESTIÓN DE CASAS Y EXPEDIENTES FAMILIARES DE CONDÓMINOS
 * =============================================================================
 * Descripción:
 *   Consultas SQL transaccionales para consultar, registrar y actualizar 
 *   viviendas, vinculando residentes/condóminos a sus inmuebles de Oracle DB.
 * =============================================================================
 */

const xlsx = require("xlsx");
const { executeQuery, withTransaction } = require("../../config/db");

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

/**
 * =============================================================================
 * CARGA MASIVA DE CASAS DESDE EXCEL
 * =============================================================================
 * Lee una hoja de cálculo (.xlsx / .xls), normaliza los encabezados y registra
 * las viviendas válidas dentro de una única transacción de Oracle. Las filas
 * duplicadas se omiten y las filas defectuosas se reportan sin abortar el lote.
 * =============================================================================
 */

const MAX_FILAS_IMPORTACION = 5000;
const ESTADOS_CASA_VALIDOS = new Set(["DISPONIBLE", "OCUPADA", "INACTIVA"]);

// Variaciones aceptadas para cada columna de la plantilla
const ALIAS_COLUMNAS = {
  numero: [
    "numero",
    "numero casa",
    "numero de casa",
    "numerocasa",
    "numero vivienda",
    "no",
    "no casa",
    "nro",
    "nro casa",
    "num",
    "num casa",
    "casa",
    "codigo",
    "codigo casa",
    "nomenclatura",
  ],
  bloque: ["bloque", "manzana", "sector", "bloque manzana", "bloque o sector", "bloque sector"],
  direccion: ["direccion", "direccion detallada", "dir", "ubicacion"],
  tipo: ["tipo", "tipo vivienda", "tipo de vivienda"],
  estado: ["estado", "estado vivienda", "estado de la vivienda"],
  observaciones: ["observaciones", "observacion", "notas", "comentario", "comentarios"],
  idPropietario: ["id propietario", "idpropietario", "id de propietario", "propietario id"],
  dpiPropietario: [
    "dpi",
    "dpi propietario",
    "identificacion propietario",
    "identificacion del propietario",
    "cui propietario",
  ],
};

/**
 * Normaliza encabezados: quita acentos, signos y espacios repetidos.
 */
function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAPA_COLUMNAS = (() => {
  const mapa = new Map();
  Object.entries(ALIAS_COLUMNAS).forEach(([canonica, alias]) => {
    mapa.set(canonica, canonica);
    alias.forEach((nombre) => mapa.set(normalizarTexto(nombre), canonica));
  });
  return mapa;
})();

/**
 * Convierte una fila cruda de Excel en un objeto con claves canónicas.
 */
function normalizarFila(fila) {
  const normalizada = {};

  Object.keys(fila).forEach((columna) => {
    const canonica = MAPA_COLUMNAS.get(normalizarTexto(columna));
    if (!canonica) return;

    const valorActual = normalizada[canonica];
    if (valorActual !== undefined && valorTexto(valorActual) !== "") return;

    normalizada[canonica] = fila[columna];
  });

  return normalizada;
}

function valorTexto(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/\s+/g, " ").trim();
}

function normalizarEstado(valor) {
  const estado = normalizarTexto(valor).toUpperCase();
  return ESTADOS_CASA_VALIDOS.has(estado) ? estado : "DISPONIBLE";
}

function claveNumero(numero) {
  return valorTexto(numero).toUpperCase();
}

function claveBloque(bloque) {
  return valorTexto(bloque).toUpperCase();
}

function clavePar(numero, bloque) {
  return `${claveNumero(numero)}||${claveBloque(bloque)}`;
}

function crearErrorValidacion(mensaje) {
  const error = new Error(mensaje);
  error.statusCode = 400;
  error.code = "INVALID_EXCEL_FILE";
  return error;
}

/**
 * Traduce los errores más frecuentes de Oracle a mensajes comprensibles.
 */
function motivoErrorOracle(error) {
  const mensaje = (error && error.message) || "";

  if (mensaje.includes("ORA-00001")) {
    return "Ya existe una casa con ese número en el sistema.";
  }
  if (mensaje.includes("ORA-01400")) {
    return "Faltan datos obligatorios para registrar la casa.";
  }
  if (mensaje.includes("ORA-02291")) {
    return "El propietario asociado no existe en el padrón de personas.";
  }
  if (mensaje.includes("ORA-12899")) {
    return "Uno de los valores excede la longitud permitida por la base de datos.";
  }

  return mensaje.replace(/\s+/g, " ").slice(0, 250) || "Error desconocido al insertar la fila.";
}

/**
 * Consulta las columnas reales de CASA para soportar esquemas con o sin
 * tipo_vivienda / observaciones / notas sin romper la sentencia INSERT.
 */
async function obtenerColumnasCasa(connection) {
  try {
    const result = await connection.execute(
      `SELECT column_name FROM user_tab_columns WHERE table_name = 'CASA'`
    );
    const columnas = new Set(
      (result.rows || []).map((row) =>
        String(row.COLUMN_NAME ?? row.column_name ?? "").toLowerCase()
      )
    );
    if (columnas.size > 0) return columnas;
  } catch (error) {
    console.warn("No se pudieron consultar las columnas de CASA:", error.message);
  }

  return new Set(["numero_casa", "bloque", "direccion", "estado", "id_propietario", "creado_por"]);
}

function construirInsertCasa(columnasCasa, userId) {
  const campos = [
    { columna: "numero_casa", bind: "numeroCasa" },
    { columna: "bloque", bind: "bloque" },
    { columna: "direccion", bind: "direccion" },
    { columna: "estado", bind: "estado" },
  ];

  if (columnasCasa.has("id_propietario")) {
    campos.push({ columna: "id_propietario", bind: "idPropietario" });
  }
  if (columnasCasa.has("creado_por") && userId) {
    campos.push({ columna: "creado_por", bind: "userId" });
  }
  if (columnasCasa.has("tipo_vivienda")) {
    campos.push({ columna: "tipo_vivienda", bind: "tipoVivienda" });
  }
  if (columnasCasa.has("observaciones")) {
    campos.push({ columna: "observaciones", bind: "observaciones" });
  } else if (columnasCasa.has("notas")) {
    campos.push({ columna: "notas", bind: "observaciones" });
  }

  const sql = `
    INSERT INTO CASA (${campos.map((campo) => campo.columna).join(", ")})
    VALUES (${campos.map((campo) => `:${campo.bind}`).join(", ")})
  `;

  return { sql, campos };
}

async function consultarPersonaPorId(connection, idPersona) {
  const id = Number(idPersona);
  if (!Number.isFinite(id)) return null;

  const result = await connection.execute(
    `SELECT id_persona FROM PERSONA WHERE id_persona = :idPersona`,
    { idPersona: id }
  );
  const rows = result.rows || [];

  if (rows.length === 0) return null;
  return Number(rows[0].ID_PERSONA ?? rows[0].id_persona);
}

async function consultarPersonaPorDpi(connection, identificacion) {
  const valor = valorTexto(identificacion);
  if (!valor) return null;

  const result = await connection.execute(
    `SELECT id_persona
     FROM PERSONA
     WHERE (dpi = :identificacion OR identificacion_alternativa = :identificacion)
       AND ROWNUM = 1`,
    { identificacion: valor }
  );
  const rows = result.rows || [];

  if (rows.length === 0) return null;
  return Number(rows[0].ID_PERSONA ?? rows[0].id_persona);
}

/**
 * Obtiene el propietario que se asignará a las casas que no traigan uno.
 * Si no se indicó un propietario, reutiliza/crea una persona "pendiente de
 * asignación" para satisfacer la restricción NOT NULL de CASA.id_propietario.
 */
async function obtenerPropietarioPorDefecto(connection, idPropietarioSolicitado) {
  if (idPropietarioSolicitado) {
    const idExistente = await consultarPersonaPorId(connection, idPropietarioSolicitado);
    if (!idExistente) {
      throw crearErrorValidacion("El propietario seleccionado no existe en el padrón de personas.");
    }
    return idExistente;
  }

  const existente = await connection.execute(
    `SELECT id_persona
     FROM PERSONA
     WHERE UPPER(identificacion_alternativa) = 'SIN-PROPIETARIO'
       AND ROWNUM = 1`
  );
  const rowsExistentes = existente.rows || [];
  if (rowsExistentes.length > 0) {
    return Number(rowsExistentes[0].ID_PERSONA ?? rowsExistentes[0].id_persona);
  }

  const oracledb = require("oracledb");

  try {
    const insercion = await connection.execute(
      `INSERT INTO PERSONA (nombres, apellidos, identificacion_alternativa)
       VALUES ('PROPIETARIO', 'PENDIENTE ASIGNACION', 'SIN-PROPIETARIO')
       RETURNING id_persona INTO :idPersonaOut`,
      { idPersonaOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
    );
    return Number(insercion.outBinds.idPersonaOut[0]);
  } catch (error) {
    // Si otra carga simultánea creó la persona, se reutiliza la existente.
    if ((error.message || "").includes("ORA-00001")) {
      const reintento = await connection.execute(
        `SELECT id_persona
         FROM PERSONA
         WHERE UPPER(identificacion_alternativa) = 'SIN-PROPIETARIO'
           AND ROWNUM = 1`
      );
      const rowsReintento = reintento.rows || [];
      if (rowsReintento.length > 0) {
        return Number(rowsReintento[0].ID_PERSONA ?? rowsReintento[0].id_persona);
      }
    }
    throw error;
  }
}

/**
 * Importa viviendas desde un archivo Excel en memoria.
 *
 * @param {Buffer} fileBuffer Contenido del archivo .xlsx / .xls.
 * @param {object} options Opciones de importación (userId, idPropietario).
 * @returns {Promise<object>} Resumen con totalProcesados, creados, omitidos y errores.
 */
async function importarCasasDesdeExcel(fileBuffer, options = {}) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw crearErrorValidacion("El archivo Excel está vacío o no se recibió correctamente.");
  }

  let workbook;
  try {
    workbook = xlsx.read(fileBuffer, { type: "buffer" });
  } catch (error) {
    throw crearErrorValidacion("El archivo no es un Excel válido o está dañado.");
  }

  const sheetName = workbook.SheetNames && workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw crearErrorValidacion("El archivo Excel no contiene hojas con datos.");
  }

  let filasCrudas;
  try {
    filasCrudas = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
    });
  } catch (error) {
    throw crearErrorValidacion("No se pudo leer la hoja del archivo Excel.");
  }

  if (!Array.isArray(filasCrudas) || filasCrudas.length === 0) {
    throw crearErrorValidacion("El archivo Excel no contiene filas con datos.");
  }

  if (filasCrudas.length > MAX_FILAS_IMPORTACION) {
    throw crearErrorValidacion(
      `El archivo supera el límite de ${MAX_FILAS_IMPORTACION} filas permitido por carga.`
    );
  }

  const columnasReconocidas = new Set(
    Object.keys(filasCrudas[0] || {})
      .map((columna) => MAPA_COLUMNAS.get(normalizarTexto(columna)))
      .filter(Boolean)
  );

  if (!columnasReconocidas.has("numero")) {
    throw crearErrorValidacion(
      'No se encontró la columna "Numero" en el archivo. Verifique la estructura de la plantilla.'
    );
  }

  const userId = options.userId ? Number(options.userId) : null;
  const idPropietarioSolicitado = options.idPropietario ? Number(options.idPropietario) : null;

  return withTransaction(async (connection) => {
    const columnasCasa = await obtenerColumnasCasa(connection);
    const { sql: insertSql, campos } = construirInsertCasa(columnasCasa, userId);

    // 1. Índices de duplicados ya persistidos en Oracle
    const existentes = await connection.execute(`SELECT numero_casa, bloque FROM CASA`);
    const paresExistentes = new Set();
    const numerosExistentes = new Set();

    (existentes.rows || []).forEach((row) => {
      const numero = row.NUMERO_CASA ?? row.numero_casa;
      const bloque = row.BLOQUE ?? row.bloque;
      paresExistentes.add(clavePar(numero, bloque));
      numerosExistentes.add(claveNumero(numero));
    });

    const errores = [];
    const omitidosDetalle = [];
    const candidatas = [];
    const paresReservados = new Set();
    const numerosReservados = new Set();
    let omitidos = 0;

    // 2. Validación y detección de duplicados (contra BD y dentro del archivo)
    filasCrudas.forEach((filaCruda, indice) => {
      const numeroFila = indice + 2; // +1 por encabezado, +1 para base 1
      const fila = normalizarFila(filaCruda);

      const numero = valorTexto(fila.numero);
      const bloque = valorTexto(fila.bloque) || "SIN BLOQUE";

      if (!numero) {
        errores.push({ fila: numeroFila, motivo: "Falta el número de casa." });
        return;
      }

      const numeroClave = claveNumero(numero);
      const parClave = clavePar(numero, bloque);
      const duplicadoEnPar = paresExistentes.has(parClave) || paresReservados.has(parClave);

      if (
        duplicadoEnPar ||
        numerosExistentes.has(numeroClave) ||
        numerosReservados.has(numeroClave)
      ) {
        omitidos += 1;
        omitidosDetalle.push({
          fila: numeroFila,
          numero,
          bloque,
          motivo: duplicadoEnPar
            ? "Duplicada: ya existe una casa con el mismo número y bloque."
            : "Duplicada: el número de casa ya está registrado en otro bloque.",
        });
        return;
      }

      paresReservados.add(parClave);
      numerosReservados.add(numeroClave);

      candidatas.push({
        fila: numeroFila,
        numero,
        bloque,
        direccion: valorTexto(fila.direccion) || `Casa ${numero}, ${bloque}`,
        estado: normalizarEstado(fila.estado),
        tipoVivienda: valorTexto(fila.tipo) || null,
        observaciones: valorTexto(fila.observaciones) || null,
        idPropietarioFila: valorTexto(fila.idPropietario) || null,
        dpiPropietarioFila: valorTexto(fila.dpiPropietario) || null,
      });
    });

    // 3. Propietario por defecto (solo si alguna fila válida no trae uno)
    let propietarioDefecto = null;
    const requierePropietarioDefecto = candidatas.some(
      (fila) => !fila.idPropietarioFila && !fila.dpiPropietarioFila
    );

    if (requierePropietarioDefecto) {
      propietarioDefecto = await obtenerPropietarioPorDefecto(
        connection,
        idPropietarioSolicitado
      );
    }

    // 4. Inserción tolerante a errores fila por fila dentro de la transacción
    let creados = 0;
    const cachePropietarios = new Map();

    for (const fila of candidatas) {
      try {
        let idPropietario = propietarioDefecto;

        if (fila.idPropietarioFila) {
          const claveCache = `ID:${fila.idPropietarioFila}`;
          if (!cachePropietarios.has(claveCache)) {
            cachePropietarios.set(
              claveCache,
              await consultarPersonaPorId(connection, fila.idPropietarioFila)
            );
          }
          idPropietario = cachePropietarios.get(claveCache);
        } else if (fila.dpiPropietarioFila) {
          const claveCache = `DPI:${fila.dpiPropietarioFila}`;
          if (!cachePropietarios.has(claveCache)) {
            cachePropietarios.set(
              claveCache,
              await consultarPersonaPorDpi(connection, fila.dpiPropietarioFila)
            );
          }
          idPropietario = cachePropietarios.get(claveCache);
        }

        if (!idPropietario) {
          errores.push({
            fila: fila.fila,
            motivo: "El propietario indicado no existe en el padrón de personas.",
          });
          continue;
        }

        const valores = {
          numeroCasa: fila.numero,
          bloque: fila.bloque.toUpperCase(),
          direccion: fila.direccion,
          estado: fila.estado,
          idPropietario,
          userId,
          tipoVivienda: fila.tipoVivienda,
          observaciones: fila.observaciones,
        };

        const binds = {};
        campos.forEach((campo) => {
          binds[campo.bind] = valores[campo.bind] ?? null;
        });

        await connection.execute(insertSql, binds);
        creados += 1;
      } catch (error) {
        errores.push({ fila: fila.fila, motivo: motivoErrorOracle(error) });
      }
    }

    return {
      totalProcesados: filasCrudas.length,
      creados,
      omitidos,
      errores,
      omitidosDetalle,
    };
  });
}

/**
 * Genera la plantilla oficial de carga masiva en formato .xlsx.
 *
 * @returns {Buffer} Libro de Excel con encabezados y filas de ejemplo.
 */
function generarPlantillaExcel() {
  const filas = [
    {
      Numero: "A-101",
      Bloque: "BLOQUE A",
      Direccion: "Sector Norte Calle Principal Casa 1",
      Tipo: "CASA",
      Estado: "DISPONIBLE",
      Observaciones: "Ejemplo: elimine esta fila antes de cargar",
    },
    {
      Numero: "A-102",
      Bloque: "BLOQUE A",
      Direccion: "Sector Norte Calle Principal Casa 2",
      Tipo: "CASA",
      Estado: "DISPONIBLE",
      Observaciones: "",
    },
  ];

  const hoja = xlsx.utils.json_to_sheet(filas, {
    header: ["Numero", "Bloque", "Direccion", "Tipo", "Estado", "Observaciones"],
  });
  hoja["!cols"] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 40 },
    { wch: 14 },
    { wch: 14 },
    { wch: 40 },
  ];

  const libro = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(libro, hoja, "Casas");

  return xlsx.write(libro, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  getAllCasas,
  getCasaById,
  createCasa,
  importarCasasDesdeExcel,
  generarPlantillaExcel,
  addResidenteToCasa,
  removeResidenteFromCasa,
  getPersonas,
  updateCasa,
  createPersona,
};