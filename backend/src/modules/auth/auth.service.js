/**
 * =============================================================================
 * CAPA DE SERVICIO: AUTENTICACIÓN Y SEGURIDAD
 * =============================================================================
 * Descripción:
 *   Encapsula las reglas de negocio y transacciones de base de datos para el
 *   ciclo de vida de autenticación: verificación de credenciales, hash de
 *   contraseñas, generación de tokens JWT y trazabilidad de accesos.
 * =============================================================================
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const { executeQuery } = require("../../config/db");

// Nombre del rol temporal que recibe toda cuenta auto-registrada mientras
// espera la aprobación de un administrador. La tabla USUARIO exige id_rol
// NOT NULL (FK a ROL), por lo que no puede quedar nulo.
const ROL_PENDIENTE = "PENDIENTE";

/**
 * Autentica un usuario contra la base de datos Oracle y genera su sesión JWT.
 * 
 * @param {string} usernameOrEmail - Nombre de usuario o correo electrónico del solicitante.
 * @param {string} password - Contraseña en texto plano proporcionada en el login.
 * @returns {Promise<{token: string, user: object}>} Token firmado y perfil básico para sesión.
 * @throws {Error} Excepciones de negocio con códigos descriptivos para el controlador.
 */
async function authenticateUser(usernameOrEmail, password) {
  // 1. Consulta SQL parametrizada con JOINs para traer perfil, credenciales y rol
  const query = `
    SELECT 
      u.id_usuario,
      u.nombre_usuario,
      u.contrasena,
      u.estado,
      u.es_verificado,
      r.id_rol,
      r.nombre AS nombre_rol,
      p.id_persona,
      p.nombres,
      p.apellidos,
      p.correo
    FROM USUARIO u
    JOIN ROL r ON u.id_rol = r.id_rol
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE (LOWER(u.nombre_usuario) = LOWER(:identifier) OR LOWER(p.correo) = LOWER(:identifier))
  `;

  const result = await executeQuery(query, { identifier: usernameOrEmail });

  if (result.rows.length === 0) {
    const error = new Error("Credenciales inválidas. Verifique su usuario o contraseña.");
    error.statusCode = 401;
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }

  const userRecord = result.rows[0];

  // 2. Validación de estado de cuenta
  if (userRecord.ESTADO !== "ACTIVO") {
    const error = new Error("La cuenta se encuentra inactiva o bloqueada por la administración.");
    error.statusCode = 403;
    error.code = "ACCOUNT_INACTIVE";
    throw error;
  }

  // 3. Verificación de hash de contraseña con Bcrypt
  const isMatch = await bcrypt.compare(password, userRecord.CONTRASENA);
  if (!isMatch) {
    const error = new Error("Credenciales inválidas. Verifique su usuario o contraseña.");
    error.statusCode = 401;
    error.code = "INVALID_CREDENTIALS";
    throw error;
  }

  // 4. Actualización del timestamp de último login (trazabilidad y auditoría)
  const updateLoginSql = `
    UPDATE USUARIO 
    SET ultimo_login = SYSTIMESTAMP 
    WHERE id_usuario = :id_usuario
  `;
  await executeQuery(updateLoginSql, { id_usuario: userRecord.ID_USUARIO }, { autoCommit: true });

  // 5. Estructuración del Payload para el JWT (información no confidencial)
  const payload = {
    userId: userRecord.ID_USUARIO,
    personaId: userRecord.ID_PERSONA,
    username: userRecord.NOMBRE_USUARIO,
    role: userRecord.NOMBRE_ROL,
    roleId: userRecord.ID_ROL,
  };

  // 6. Firma criptográfica del token JWT
  const secretKey = process.env.JWT_SECRET || "fallback_secret_condominio_dev";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const token = jwt.sign(payload, secretKey, { expiresIn });

  // 7. Retorno del resultado excluyendo la contraseña
  return {
    token,
    user: {
      id: userRecord.ID_USUARIO,
      username: userRecord.NOMBRE_USUARIO,
      fullName: `${userRecord.NOMBRES} ${userRecord.APELLIDOS}`,
      email: userRecord.CORREO,
      role: userRecord.NOMBRE_ROL,
      isVerified: userRecord.ES_VERIFICADO === "SI",
    },
  };
}

/**
 * Obtiene el perfil completo del usuario autenticado en base a su ID.
 * Útil para restablecer el contexto en el frontend (React) tras un refresco de página.
 * 
 * @param {number} userId - Identificador primario de la tabla USUARIO.
 * @returns {Promise<object>} Perfil consolidado del usuario.
 */
async function getUserProfileById(userId) {
  const query = `
    SELECT 
      u.id_usuario,
      u.nombre_usuario,
      u.es_verificado,
      u.ultimo_login,
      r.nombre AS nombre_rol,
      p.nombres,
      p.apellidos,
      p.correo,
      p.telefono,
      p.dpi
    FROM USUARIO u
    JOIN ROL r ON u.id_rol = r.id_rol
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE u.id_usuario = :userId AND u.estado = 'ACTIVO'
  `;

  const result = await executeQuery(query, { userId });

  if (result.rows.length === 0) {
    const error = new Error("El usuario asociado a la sesión no existe o fue deshabilitado.");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const row = result.rows[0];
  return {
    id: row.ID_USUARIO,
    username: row.NOMBRE_USUARIO,
    fullName: `${row.NOMBRES} ${row.APELLIDOS}`,
    email: row.CORREO,
    phone: row.TELEFONO,
    dpi: row.DPI,
    role: row.NOMBRE_ROL,
    isVerified: row.ES_VERIFICADO === "SI",
    lastLogin: row.ULTIMO_LOGIN,
  };
}

/**
 * Obtiene el id del rol temporal "PENDIENTE", creándolo si aún no existe.
 * Necesario porque USUARIO.id_rol es NOT NULL y una solicitud de auto-registro
 * todavía no tiene un rol definitivo asignado.
 *
 * @returns {Promise<number>} Identificador del rol temporal.
 */
async function obtenerRolPendienteId() {
  const selectSql = `SELECT id_rol FROM ROL WHERE nombre = :nombre`;
  const existente = await executeQuery(selectSql, { nombre: ROL_PENDIENTE });

  if (existente.rows.length > 0) {
    return existente.rows[0].ID_ROL;
  }

  const insertSql = `
    INSERT INTO ROL (nombre, descripcion, estado)
    VALUES (:nombre, :descripcion, 'ACTIVO')
    RETURNING id_rol INTO :idRolOut
  `;

  const insertResult = await executeQuery(
    insertSql,
    {
      nombre: ROL_PENDIENTE,
      descripcion: "Rol temporal para solicitudes de auto-registro pendientes de aprobación.",
      idRolOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
    { autoCommit: true }
  );

  return insertResult.outBinds.idRolOut[0];
}

/**
 * Auto-registro público de un nuevo usuario.
 *
 * Flujo:
 *   1. Valida duplicados (nombre de usuario, correo y DPI).
 *   2. Inserta la Persona física en PERSONA.
 *   3. Hashea la contraseña con Bcrypt.
 *   4. Inserta la cuenta en USUARIO con rol temporal, es_verificado = 'NO'
 *      y estado = 'INACTIVO' (quedará sujeta a aprobación administrativa).
 *
 * Nota: Oracle no permite abarcar dos executeQuery en una misma transacción;
 * por eso se usan inserciones consecutivas con compensación: si el INSERT en
 * USUARIO falla, se elimina la PERSONA recién creada para no dejar huérfanos.
 *
 * @param {object} data - Datos del formulario de registro.
 * @returns {Promise<{idUsuario: number, message: string}>}
 */
async function registerUser(data) {
  const {
    nombres,
    apellidos,
    dpi,
    telefono,
    correo,
    nombreUsuario,
    contrasena,
  } = data || {};

  const nombreUsuarioNorm = String(nombreUsuario || "").trim().toLowerCase();
  const correoNorm = String(correo || "").trim().toLowerCase();
  const dpiNorm = dpi ? String(dpi).trim() : null;

  // 1. Verificación temprana de duplicados con mensajes de negocio claros
  const dupSql = `
    SELECT
      (SELECT COUNT(*) FROM USUARIO WHERE LOWER(nombre_usuario) = :nombreUsuario) AS existe_usuario,
      (SELECT COUNT(*) FROM PERSONA WHERE LOWER(correo) = :correo) AS existe_correo,
      (SELECT COUNT(*) FROM PERSONA WHERE dpi = :dpi) AS existe_dpi
    FROM DUAL
  `;
  const dupResult = await executeQuery(dupSql, {
    nombreUsuario: nombreUsuarioNorm,
    correo: correoNorm,
    dpi: dpiNorm,
  });
  const dup = dupResult.rows[0];

  if (dup.EXISTE_USUARIO > 0) {
    const error = new Error("El nombre de usuario ya está en uso. Elija otro.");
    error.statusCode = 409;
    error.code = "USERNAME_TAKEN";
    throw error;
  }
  if (dup.EXISTE_CORREO > 0) {
    const error = new Error("El correo electrónico ya está registrado en el sistema.");
    error.statusCode = 409;
    error.code = "EMAIL_TAKEN";
    throw error;
  }
  if (dpiNorm && dup.EXISTE_DPI > 0) {
    const error = new Error("El DPI ya está registrado en el sistema.");
    error.statusCode = 409;
    error.code = "DPI_TAKEN";
    throw error;
  }

  // 2. Inserción en PERSONA (devuelve la PK autogenerada por Oracle)
  const personaSql = `
    INSERT INTO PERSONA (nombres, apellidos, dpi, telefono, correo, estado)
    VALUES (:nombres, :apellidos, :dpi, :telefono, :correo, 'ACTIVO')
    RETURNING id_persona INTO :idPersonaOut
  `;

  const personaResult = await executeQuery(
    personaSql,
    {
      nombres: String(nombres || "").trim(),
      apellidos: String(apellidos || "").trim(),
      dpi: dpiNorm,
      telefono: telefono ? String(telefono).trim() : null,
      correo: correoNorm,
      idPersonaOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
    { autoCommit: true }
  );

  const idPersona = personaResult.outBinds.idPersonaOut[0];

  // 3. Hash de la contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(contrasena, salt);

  // 4. Inserción en USUARIO con rol temporal y cuenta NO verificada / INACTIVA
  const idRolPendiente = await obtenerRolPendienteId();

  const usuarioSql = `
    INSERT INTO USUARIO (
      id_persona,
      id_rol,
      nombre_usuario,
      contrasena,
      es_verificado,
      estado
    ) VALUES (
      :idPersona,
      :idRol,
      :nombreUsuario,
      :contrasena,
      'NO',
      'INACTIVO'
    ) RETURNING id_usuario INTO :idUsuarioOut
  `;

  try {
    const usuarioResult = await executeQuery(
      usuarioSql,
      {
        idPersona,
        idRol: idRolPendiente,
        nombreUsuario: nombreUsuarioNorm,
        contrasena: hashedPassword,
        idUsuarioOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    return {
      idUsuario: usuarioResult.outBinds.idUsuarioOut[0],
      message: "Solicitud de registro recibida. Espere la aprobación de un administrador.",
    };
  } catch (error) {
    // Compensación: evitar dejar una PERSONA huérfana si falla el INSERT de USUARIO
    try {
      await executeQuery(
        `DELETE FROM PERSONA WHERE id_persona = :idPersona`,
        { idPersona },
        { autoCommit: true }
      );
    } catch (cleanupError) {
      console.error("No se pudo revertir la PERSONA tras fallo de registro:", cleanupError.message);
    }
    throw error;
  }
}

module.exports = {
  authenticateUser,
  getUserProfileById,
  registerUser,
};