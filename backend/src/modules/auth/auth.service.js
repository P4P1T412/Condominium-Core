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
const crypto = require("crypto");
const oracledb = require("oracledb");
const { executeQuery } = require("../../config/db");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../../utils/email.service");

// Nombre del rol temporal que recibe toda cuenta auto-registrada mientras
// espera la aprobación de un administrador. La tabla USUARIO exige id_rol
// NOT NULL (FK a ROL), por lo que no puede quedar nulo.
const ROL_PENDIENTE = "PENDIENTE";

// Vigencia del código de verificación de correo (en días)
const DIAS_VIGENCIA_CODIGO = 1;

// Vigencia del enlace de recuperación de contraseña (en horas)
const HORAS_VIGENCIA_TOKEN = 1;

/**
 * Autentica un usuario contra la base de datos Oracle y genera su sesión JWT.
 * 
 * @param {string} usernameOrEmail Nombre de usuario o correo electrónico del solicitante.
 * @param {string} password Contraseña en texto plano proporcionada en el login.
 * @returns {Promise<{token: string, user: object}>} Token firmado y perfil básico para sesión.
 * @throws {Error} Excepciones de negocio con códigos descriptivos para el controlador.
 */
async function authenticateUser(usernameOrEmail, password) {
  // 1. Consulta SQL parametrizada con JOINs para traer perfil, credenciales, rol e id_casa (si aplica)
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
      p.correo,
      res.id_casa
    FROM USUARIO u
    JOIN ROL r ON u.id_rol = r.id_rol
    JOIN PERSONA p ON u.id_persona = p.id_persona
    LEFT JOIN RESIDENTE res ON p.id_persona = res.id_persona
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

  // 5. Estructuración del Payload para el JWT (incluye casaId para contexto del cliente/residente)
  const payload = {
    id: userRecord.ID_USUARIO,
    userId: userRecord.ID_USUARIO,
    personaId: userRecord.ID_PERSONA,
    username: userRecord.NOMBRE_USUARIO,
    role: userRecord.NOMBRE_ROL,
    rol: userRecord.NOMBRE_ROL,
    roleId: userRecord.ID_ROL,
    casaId: userRecord.ID_CASA || null,
  };

  // 6. Firma criptográfica del token JWT
  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    const error = new Error("JWT_SECRET no está configurado en el backend.");
    error.statusCode = 500;
    error.code = "SERVER_CONFIG_ERROR";
    throw error;
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";

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
      rol: userRecord.NOMBRE_ROL,
      casaId: userRecord.ID_CASA || null,
      isVerified: userRecord.ES_VERIFICADO === "SI",
    },
  };
}

/**
 * Obtiene el perfil completo del usuario autenticado en base a su ID.
 * Útil para restablecer el contexto en el frontend (React) tras un refresco de página.
 * 
 * @param {number} userId Identificador primario de la tabla USUARIO.
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
      p.dpi,
      res.id_casa
    FROM USUARIO u
    JOIN ROL r ON u.id_rol = r.id_rol
    JOIN PERSONA p ON u.id_persona = p.id_persona
    LEFT JOIN RESIDENTE res ON p.id_persona = res.id_persona
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
    rol: row.NOMBRE_ROL,
    casaId: row.ID_CASA || null,
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
 * Genera un código numérico aleatorio de 6 dígitos (con ceros a la izquierda
 * si corresponde), criptográficamente seguro.
 *
 * @returns {string} Código de 6 dígitos como cadena (ej. "048213").
 */
function generarCodigoVerificacion() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/**
 * Auto-registro público de un nuevo usuario.
 *
 * @param {object} data Datos del formulario de registro.
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

  // 1. Verificación temprana de duplicados
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

  // 2. Inserción en PERSONA
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

  // 4. Generación del código de verificación de correo
  const codigoVerificacion = generarCodigoVerificacion();

  // 5. Inserción en USUARIO
  const idRolPendiente = await obtenerRolPendienteId();

  const usuarioSql = `
    INSERT INTO USUARIO (
      id_persona,
      id_rol,
      nombre_usuario,
      contrasena,
      es_verificado,
      estado,
      codigo_verificacion,
      expiracion_codigo
    ) VALUES (
      :idPersona,
      :idRol,
      :nombreUsuario,
      :contrasena,
      'NO',
      'INACTIVO',
      :codigoVerificacion,
      SYSTIMESTAMP + INTERVAL '${DIAS_VIGENCIA_CODIGO}' DAY
    ) RETURNING id_usuario INTO :idUsuarioOut
  `;

  let idUsuario;

  try {
    const usuarioResult = await executeQuery(
      usuarioSql,
      {
        idPersona,
        idRol: idRolPendiente,
        nombreUsuario: nombreUsuarioNorm,
        contrasena: hashedPassword,
        codigoVerificacion,
        idUsuarioOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
      { autoCommit: true }
    );

    idUsuario = usuarioResult.outBinds.idUsuarioOut[0];
  } catch (error) {
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

  // 6. Envío del correo de verificación
  try {
    await sendVerificationEmail(correoNorm, nombres, codigoVerificacion);
  } catch (emailError) {
    console.error(
      `No se pudo enviar el correo de verificación a ${correoNorm}: ${emailError.message}`
    );
  }

  return {
    idUsuario,
    message:
      "Solicitud de registro recibida. Revise su correo e ingrese el código de verificación de 6 dígitos.",
  };
}

/**
 * Verifica el correo electrónico de una cuenta usando el código de 6 dígitos.
 *
 * @param {string} codigo Código numérico de 6 dígitos recibido por correo.
 * @returns {Promise<{message: string}>}
 */
async function verifyEmailCode(codigo) {
  const codigoNorm = String(codigo || "").trim();

  const findSql = `
    SELECT id_usuario
    FROM USUARIO
    WHERE codigo_verificacion = :codigo
      AND expiracion_codigo IS NOT NULL
      AND expiracion_codigo > SYSTIMESTAMP
    ORDER BY fecha_creacion DESC
    FETCH FIRST 1 ROWS ONLY
  `;
  const findResult = await executeQuery(findSql, { codigo: codigoNorm });

  if (findResult.rows.length === 0) {
    const error = new Error(
      "El código de verificación es inválido o ha expirado. Solicite uno nuevo."
    );
    error.statusCode = 400;
    error.code = "INVALID_VERIFICATION_CODE";
    throw error;
  }

  const idUsuario = findResult.rows[0].ID_USUARIO;

  const updateSql = `
    UPDATE USUARIO
    SET es_verificado = 'SI',
        codigo_verificacion = NULL,
        expiracion_codigo = NULL
    WHERE id_usuario = :idUsuario
  `;
  await executeQuery(updateSql, { idUsuario }, { autoCommit: true });

  return {
    message: "Correo verificado correctamente. Su cuenta queda a la espera de aprobación por un administrador.",
  };
}

/**
 * Reenvía el código de verificación a un correo que aún no ha sido verificado.
 *
 * @param {string} correo Correo electrónico del solicitante.
 * @returns {Promise<{message: string}>}
 */
async function resendVerificationCode(correo) {
  const correoNorm = String(correo || "").trim().toLowerCase();

  const findSql = `
    SELECT u.id_usuario, u.es_verificado, u.fecha_creacion, p.nombres
    FROM USUARIO u
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE LOWER(p.correo) = LOWER(:correo)
    ORDER BY u.fecha_creacion DESC
    FETCH FIRST 1 ROWS ONLY
  `;
  const findResult = await executeQuery(findSql, { correo: correoNorm });

  if (findResult.rows.length === 0) {
    const error = new Error("No existe una cuenta asociada a ese correo.");
    error.statusCode = 404;
    error.code = "EMAIL_NOT_FOUND";
    throw error;
  }

  const usuario = findResult.rows[0];

  if (usuario.ES_VERIFICADO === "SI") {
    const error = new Error("El correo ya ha sido verificado.");
    error.statusCode = 400;
    error.code = "EMAIL_ALREADY_VERIFIED";
    throw error;
  }

  const nuevoCodigo = generarCodigoVerificacion();

  const updateSql = `
    UPDATE USUARIO
    SET codigo_verificacion = :codigo,
        expiracion_codigo = SYSTIMESTAMP + INTERVAL '${DIAS_VIGENCIA_CODIGO}' DAY
    WHERE id_usuario = :idUsuario
  `;
  await executeQuery(
    updateSql,
    { codigo: nuevoCodigo, idUsuario: usuario.ID_USUARIO },
    { autoCommit: true }
  );

  try {
    await sendVerificationEmail(correoNorm, usuario.NOMBRES, nuevoCodigo);
  } catch (emailError) {
    console.error(
      `No se pudo reenviar el correo de verificación a ${correoNorm}: ${emailError.message}`
    );
  }

  return { message: "Código reenviado al correo." };
}

/**
 * Solicita el restablecimiento de contraseña para un correo registrado.
 *
 * @param {string} correo Correo electrónico del solicitante.
 * @returns {Promise<{message: string}>} Mensaje genérico de confirmación.
 */
async function forgotPassword(correo) {
  const correoNorm = String(correo || "").trim().toLowerCase();

  const mensajeGenerico =
    "Si el correo está registrado, recibirá un enlace para restablecer su contraseña.";

  const findSql = `
    SELECT u.id_usuario, p.nombres
    FROM USUARIO u
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE LOWER(p.correo) = LOWER(:correo)
    FETCH FIRST 1 ROWS ONLY
  `;
  const findResult = await executeQuery(findSql, { correo: correoNorm });

  if (findResult.rows.length === 0) {
    return { message: mensajeGenerico };
  }

  const usuario = findResult.rows[0];

  const token = crypto.randomBytes(32).toString("hex");

  const updateSql = `
    UPDATE USUARIO
    SET token_recuperacion = :token,
        expiracion_token = SYSTIMESTAMP + INTERVAL '${HORAS_VIGENCIA_TOKEN}' HOUR
    WHERE id_usuario = :idUsuario
  `;
  await executeQuery(
    updateSql,
    { token, idUsuario: usuario.ID_USUARIO },
    { autoCommit: true }
  );

  try {
    await sendPasswordResetEmail(correoNorm, usuario.NOMBRES, token);
  } catch (emailError) {
    console.error(
      `No se pudo enviar el correo de recuperación a ${correoNorm}: ${emailError.message}`
    );
  }

  return { message: mensajeGenerico };
}

/**
 * Restablece la contraseña de una cuenta a partir de un token vigente.
 *
 * @param {string} token Token recibido en el enlace de recuperación.
 * @param {string} nuevaContrasena Nueva contraseña en texto plano.
 * @returns {Promise<{message: string}>}
 */
async function resetPassword(token, nuevaContrasena) {
  const tokenNorm = String(token || "").trim();

  const findSql = `
    SELECT id_usuario
    FROM USUARIO
    WHERE token_recuperacion = :token
      AND expiracion_token IS NOT NULL
      AND expiracion_token > SYSTIMESTAMP
    FETCH FIRST 1 ROWS ONLY
  `;
  const findResult = await executeQuery(findSql, { token: tokenNorm });

  if (findResult.rows.length === 0) {
    const error = new Error("Token inválido o expirado");
    error.statusCode = 400;
    error.code = "INVALID_RESET_TOKEN";
    throw error;
  }

  const idUsuario = findResult.rows[0].ID_USUARIO;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(nuevaContrasena, salt);

  const updateSql = `
    UPDATE USUARIO
    SET contrasena = :contrasena,
        token_recuperacion = NULL,
        expiracion_token = NULL
    WHERE id_usuario = :idUsuario
  `;
  await executeQuery(
    updateSql,
    { contrasena: hashedPassword, idUsuario },
    { autoCommit: true }
  );

  return {
    message: "Contraseña restablecida correctamente. Ya puede iniciar sesión con su nueva contraseña.",
  };
}

module.exports = {
  authenticateUser,
  getUserProfileById,
  registerUser,
  verifyEmailCode,
  resendVerificationCode,
  forgotPassword,
  resetPassword,
};