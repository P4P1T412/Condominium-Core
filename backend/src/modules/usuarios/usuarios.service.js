/**
 * =============================================================================
 * CAPA DE SERVICIO: GESTIÓN DE USUARIOS Y ROLES
 * =============================================================================
 */

const bcrypt = require("bcrypt");
const { executeQuery } = require("../../config/db");

/**
 * Obtiene todos los usuarios del sistema con datos de su persona y rol.
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
 * Obtiene el catálogo de roles disponibles.
 */
async function getRoles() {
  const query = `
    SELECT id_rol, nombre, descripcion, estado
    FROM ROL
    WHERE estado = 'ACTIVO'
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

module.exports = {
  getAllUsuarios,
  getRoles, 
  createUsuario,
  updateEstadoUsuario,
  updateRolUsuario,
};