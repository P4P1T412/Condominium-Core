const notificacionesService = require("./notificaciones.service");

/**
 * Obtiene la lista de comunicados de la base de datos
 */
exports.obtenerComunicados = async (req, res, next) => {
  try {
    const data = await notificacionesService.obtenerComunicados(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Crea y emite un comunicado o notificación
 */
exports.crearComunicado = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?.id_usuario || 1;
    const resultado = await notificacionesService.crearComunicado(req.body, adminId);
    res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Inactiva un comunicado emitido
 */
exports.desactivarComunicado = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resultado = await notificacionesService.desactivarComunicado(id);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};