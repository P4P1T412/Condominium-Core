const quejasService = require("./quejas.service");

/**
 * GET /api/quejas
 * Lista las quejas propias (residente) o todas (administrador/garita).
 */
exports.listarQuejas = async (req, res, next) => {
  try {
    const quejas = await quejasService.listarQuejas(req.user);
    return res.status(200).json({ success: true, data: quejas });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/quejas
 * Cualquier usuario autenticado puede registrar una queja o sugerencia.
 */
exports.crearQueja = async (req, res, next) => {
  try {
    const resultado = await quejasService.crearQueja(req.body, req.user);
    return res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/quejas/usuarios
 * Catálogo mínimo de usuarios para el combo de destinatario específico.
 */
exports.obtenerUsuariosDestino = async (req, res, next) => {
  try {
    const usuarios = await quejasService.obtenerUsuariosDestino();
    return res.status(200).json({ success: true, data: usuarios });
  } catch (error) {
    next(error);
  }
};
