/**
 * =============================================================================
 * CAPA DE SERVICIO: GESTIÓN DE USUARIOS Y ROLES
 * =============================================================================
 */

const bcrypt = require("bcrypt");
const { executeQuery } = require("../../config/db");

/**
 * Obtiene todos los usuarios del sistema con datos de su persona y rol.
 * Excluye las cuentas auto-registradas que aún no fueron aprobadas
 * (es_verificado = 'NO'); éstas se gestionan únicamente desde el módulo
 * de Solicitudes Pendientes para evitar duplicidad visual.
 */
async function getAllUsuarios() {
  const query = `
    SELECT 
      u.id_usuario,
      u.nombre_usuario,
      u.estado,
      u.es_verificado,
      u.ultimo_login,
      u.fecha_creacion,
      r.id_rol,
      r.nombre AS nombre_rol,
      r.descripcion AS descripcion_rol,
      p.id_persona,
      p.nombres || ' ' || p.apellidos AS nombre_completo,
      p.correo,
      p.telefono,
      p.dpi
    FROM USUARIO u
    JOIN ROL r ON u.id_rol = r.id_rol
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE u.es_verificado = 'SI'
    ORDER BY u.id_usuario ASC
  `;

  const result = await executeQuery(query, {});

  return result.rows.map((row) => ({
    idUsuario: row.ID_USUARIO,
    nombreUsuario: row.NOMBRE_USUARIO,
    estado: row.ESTADO,
    esVerificado: row.ES_VERIFICADO === "SI",
    ultimoLogin: row.ULTIMO_LOGIN,
    fechaCreacion: row.FECHA_CREACION,
    rol: {
      idRol: row.ID_ROL,
      nombre: row.NOMBRE_ROL,
      descripcion: row.DESCRIPCION_ROL,
    },
    persona: {
      idPersona: row.ID_PERSONA,
      nombreCompleto: row.NOMBRE_COMPLETO,
      correo: row.CORREO,
      telefono: row.TELEFONO,
      dpi: row.DPI,
    },
  }));
}

/**
 * Obtiene el catálogo de roles asignables.
 * Se excluye el rol temporal 'PENDIENTE' porque no es una atribución real
 * que el administrador deba otorgar manualmente.
 */
async function getRoles() {
  const query = `
    SELECT id_rol, nombre, descripcion, estado
    FROM ROL
    WHERE estado = 'ACTIVO'
      AND nombre <> 'PENDIENTE'
    ORDER BY id_rol ASC
  `;

  const result = await executeQuery(query, {});

  return result.rows.map((row) => ({
    idRol: row.ID_ROL,
    nombre: row.NOMBRE,
    descripcion: row.DESCRIPCION,
  }));
}

/**
 * Registra una nueva cuenta de usuario asignada a una Persona física existente.
 */
async function createUsuario({ idPersona, idRol, nombreUsuario, contrasena }) {
  // 1. Verificar que la persona no tenga ya un usuario asignado (restricción uq_usuario_persona)
  const queryPersonaCheck = `
    SELECT id_usuario FROM USUARIO WHERE id_persona = :idPersona
  `;
  const personaCheck = await executeQuery(queryPersonaCheck, { idPersona: Number(idPersona) });
  if (personaCheck.rows.length > 0) {
    const error = new Error("Esta persona ya tiene una cuenta de usuario asignada.");
    error.statusCode = 400;
    error.code = "USER_ALREADY_EXISTS";
    throw error;
  }

  // 2. Hash de contraseña
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(contrasena, salt);

  // 3. Inserción en USUARIO
  const insertSql = `
    INSERT INTO USUARIO (
      id_persona,
      id_rol,
      nombre_usuario,
      contrasena,
      estado,
      es_verificado
    ) VALUES (
      :idPersona,
      :idRol,
      LOWER(:nombreUsuario),
      :hashedPassword,
      'ACTIVO',
      'SI'
    ) RETURNING id_usuario INTO :id_usuario_out
  `;

  const binds = {
    idPersona: Number(idPersona),
    idRol: Number(idRol),
    nombreUsuario: nombreUsuario.trim(),
    hashedPassword,
    id_usuario_out: { dir: require("oracledb").BIND_OUT, type: require("oracledb").NUMBER },
  };

  const result = await executeQuery(insertSql, binds, { autoCommit: true });
  return {
    idUsuario: result.outBinds.id_usuario_out[0],
    message: "Usuario creado exitosamente.",
  };
}

/**
 * Cambia el estado de una cuenta (ACTIVO / INACTIVO).
 */
async function updateEstadoUsuario(idUsuario, nuevoEstado) {
  const query = `
    UPDATE USUARIO
    SET estado = :estado
    WHERE id_usuario = :idUsuario
  `;

  await executeQuery(
    query,
    { estado: nuevoEstado, idUsuario: Number(idUsuario) },
    { autoCommit: true }
  );

  return { message: `Estado actualizado a ${nuevoEstado} exitosamente.` };
}

/**
 * Asigna un nuevo rol a la cuenta de usuario.
 */
async function updateRolUsuario(idUsuario, idRol) {
  const query = `
    UPDATE USUARIO
    SET id_rol = :idRol
    WHERE id_usuario = :idUsuario
  `;

  await executeQuery(
    query,
    { idRol: Number(idRol), idUsuario: Number(idUsuario) },
    { autoCommit: true }
  );

  return { message: "Rol asignado correctamente." };
}

/**
 * Lista las cuentas auto-registradas que aún esperan aprobación
 * (es_verificado = 'NO'), junto con los datos de su PERSONA asociada.
 */
async function getUsuariosPendientes() {
  const query = `
    SELECT 
      u.id_usuario,
      u.nombre_usuario,
      u.estado,
      u.es_verificado,
      u.fecha_creacion,
      p.id_persona,
      p.nombres,
      p.apellidos,
      p.nombres || ' ' || p.apellidos AS nombre_completo,
      p.correo,
      p.telefono,
      p.dpi
    FROM USUARIO u
    JOIN PERSONA p ON u.id_persona = p.id_persona
    WHERE u.es_verificado = 'NO'
    ORDER BY u.fecha_creacion ASC
  `;

  const result = await executeQuery(query, {});

  return result.rows.map((row) => ({
    idUsuario: row.ID_USUARIO,
    nombreUsuario: row.NOMBRE_USUARIO,
    estado: row.ESTADO,
    esVerificado: row.ES_VERIFICADO === "SI",
    fechaCreacion: row.FECHA_CREACION,
    persona: {
      idPersona: row.ID_PERSONA,
      nombres: row.NOMBRES,
      apellidos: row.APELLIDOS,
      nombreCompleto: row.NOMBRE_COMPLETO,
      correo: row.CORREO,
      telefono: row.TELEFONO,
      dpi: row.DPI,
    },
  }));
}

/**
 * Aprueba una solicitud de auto-registro: marca la cuenta como verificada,
 * la activa y le asigna el rol definitivo elegido por el administrador.
 */
async function aprobarUsuario(idUsuario, idRol) {
  const query = `
    UPDATE USUARIO
    SET es_verificado = 'SI',
        estado = 'ACTIVO',
        id_rol = :idRol
    WHERE id_usuario = :idUsuario
      AND es_verificado = 'NO'
  `;

  const result = await executeQuery(
    query,
    { idUsuario: Number(idUsuario), idRol: Number(idRol) },
    { autoCommit: true }
  );

  if (result.rowsAffected === 0) {
    const error = new Error("La solicitud no existe o ya fue procesada anteriormente.");
    error.statusCode = 404;
    error.code = "SOLICITUD_NOT_FOUND";
    throw error;
  }

  return { message: "Usuario aprobado y activado correctamente." };
}

/**
 * Rechaza una solicitud de auto-registro eliminando la cuenta de USUARIO
 * y, cuando no esté referenciada en otras tablas, también su PERSONA.
 */
async function rechazarUsuario(idUsuario) {
  const id = Number(idUsuario);

  // 1. Se recupera la persona solo si la cuenta sigue pendiente
  const checkSql = `
    SELECT id_persona
    FROM USUARIO
    WHERE id_usuario = :id AND es_verificado = 'NO'
  `;
  const check = await executeQuery(checkSql, { id });

  if (check.rows.length === 0) {
    const error = new Error("La solicitud no existe o ya fue procesada anteriormente.");
    error.statusCode = 404;
    error.code = "SOLICITUD_NOT_FOUND";
    throw error;
  }

  const idPersona = check.rows[0].ID_PERSONA;

  // 2. Eliminación física de la cuenta
  await executeQuery(
    `DELETE FROM USUARIO WHERE id_usuario = :id`,
    { id },
    { autoCommit: true }
  );

  // 3. Eliminación física de la persona (si no está referenciada en otras tablas)
  try {
    await executeQuery(
      `DELETE FROM PERSONA WHERE id_persona = :idPersona`,
      { idPersona },
      { autoCommit: true }
    );
  } catch (error) {
    console.error(
      `No se pudo eliminar la PERSONA ${idPersona} al rechazar la solicitud: ${error.message}`
    );
  }

  return { message: "Solicitud rechazada y eliminada del sistema." };
}

module.exports = {
  getAllUsuarios,
  getRoles, 
  createUsuario,
  updateEstadoUsuario,
  updateRolUsuario,
  getUsuariosPendientes,
  aprobarUsuario,
  rechazarUsuario,
};