const notificacionesService = require("./notificaciones.service");

/**
 * Obtener todos los comunicados/notificaciones según el Rol y Casa del usuario
 */
exports.obtenerComunicados = async (req, res, next) => {
  try {
    const comunicados = await notificacionesService.obtenerComunicados(req.user);
    res.json({ success: true, data: comunicados });
  } catch (error) {
    next(error);
  }
};

/**
 * Crear y emitir un comunicado multicanal (Global o Individual)
 */
exports.crearComunicado = async (req, res, next) => {
  try {
    const { titulo, contenido } = req.body;

    if (!titulo || !contenido) {
      return res.status(400).json({
        success: false,
        message: "El título y el contenido del comunicado son requeridos.",
      });
    }

    const resultado = await notificacionesService.crearComunicado(req.body, req.user.id);
    res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Inactivar o anular un comunicado (Solo Administrador)
 */
exports.desactivarComunicado = async (req, res, next) => {
  try {
    const { idComunicado } = req.params;
    const resultado = await notificacionesService.desactivarComunicado(Number(idComunicado));
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};