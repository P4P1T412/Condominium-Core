/**
 * =============================================================================
 * CONTROLADOR: GESTIÓN DE USUARIOS Y ROLES
 * =============================================================================
 */

const usuariosService = require("./usuarios.service");

async function getUsuarios(req, res, next) {
  try {
    const data = await usuariosService.getAllUsuarios();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getRoles(req, res, next) {
  try {
    const data = await usuariosService.getRoles();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function createUsuario(req, res, next) {
  try {
    const { idPersona, idRol, nombreUsuario, contrasena } = req.body;

    if (!idPersona || !idRol || !nombreUsuario || !contrasena) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Todos los campos (persona, rol, nombre de usuario y contraseña) son obligatorios.",
      });
    }

    const result = await usuariosService.createUsuario(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function updateEstado(req, res, next) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!["ACTIVO", "INACTIVO"].includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "El estado debe ser ACTIVO o INACTIVO.",
      });
    }

    // Evitar que el administrador se bloquee a sí mismo
    if (Number(id) === req.user.userId && estado === "INACTIVO") {
      return res.status(400).json({
        success: false,
        message: "No puedes suspender tu propia cuenta de administrador en sesión.",
      });
    }

    const result = await usuariosService.updateEstadoUsuario(id, estado);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function updateRol(req, res, next) {
  try {
    const { id } = req.params;
    const { idRol } = req.body;

    if (!idRol) {
      return res.status(400).json({
        success: false,
        message: "Debe seleccionar un rol válido.",
      });
    }

    const result = await usuariosService.updateRolUsuario(id, idRol);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/usuarios/pendientes
 * Lista de solicitudes de auto-registro esperando aprobación.
 */
async function getPendientes(req, res, next) {
  try {
    const data = await usuariosService.getUsuariosPendientes();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/usuarios/:id/aprobar
 * Aprueba una solicitud y asigna el rol definitivo recibido en el body.
 */
async function aprobar(req, res, next) {
  try {
    const { id } = req.params;
    const { idRol } = req.body;

    if (!idRol) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Debe seleccionar el rol que se asignará al aprobar la solicitud.",
      });
    }

    const result = await usuariosService.aprobarUsuario(id, idRol);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/usuarios/:id/rechazar
 * Rechaza y elimina una solicitud de auto-registro.
 */
async function rechazar(req, res, next) {
  try {
    const { id } = req.params;
    const result = await usuariosService.rechazarUsuario(id);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsuarios,
  getRoles,
  createUsuario,
  updateEstado,
  updateRol,
  getPendientes,
  aprobar,
  rechazar,
};