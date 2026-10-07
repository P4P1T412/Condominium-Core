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
const { executeQuery } = require("../../config/db");

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

module.exports = {
  authenticateUser,
  getUserProfileById,
};