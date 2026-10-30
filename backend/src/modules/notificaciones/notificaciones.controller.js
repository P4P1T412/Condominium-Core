const notificacionesService = require("./notificaciones.service");

exports.obtenerComunicados = async (req, res, next) => {
  try {
    const listaOriginal = await notificacionesService.obtenerComunicados(req.user);

    const comunicados = Array.isArray(listaOriginal)
      ? listaOriginal
      : listaOriginal?.data || listaOriginal?.rows || [];

    const datosNormalizados = comunicados.map((item) => ({
      id_comunicado: item.ID_COMUNICADO || item.id_comunicado || item.ID || item.id,
      titulo: item.TITULO || item.titulo || item.Titulo || "Aviso Oficial",
      contenido: item.CONTENIDO || item.contenido || item.Contenido || item.mensaje || item.MENSAJE || "",
      categoria: item.CATEGORIA || item.categoria || "General",
      tipo_destino: item.TIPO_DESTINO || item.tipo_destino || "GLOBAL",
      prioridad: item.PRIORIDAD || item.prioridad || "NORMAL",
      fecha_publicacion: item.FECHA_PUBLICACION || item.fecha_publicacion || item.FECHA || item.fecha || null,
      fecha_vencimiento: item.FECHA_VENCIMIENTO || item.fecha_vencimiento || null,
      canal_envio: item.CANAL_ENVIO || item.canal_envio || item.CANAL || "APP",
      estado: item.ESTADO || item.estado || "ACTIVO",
      autor: item.AUTOR || item.autor || "Administración",
      id_casa_destino: item.ID_CASA_DESTINO || item.id_casa_destino || null,
      numero_casa: item.NUMERO_CASA || item.numero_casa || null,
      roles_destino: item.ROLES_DESTINO || item.roles_destino || null,
      total_lecturas: Number(item.TOTAL_LECTURAS || item.total_lecturas || 0),
      total_destinatarios: Number(item.TOTAL_DESTINATARIOS || item.total_destinatarios || 0),
      fecha_lectura: item.FECHA_LECTURA || item.fecha_lectura || null,
    }));

    console.log(`[NOTIFICACIONES] Total devuelto al cliente: ${datosNormalizados.length} registros.`);

    return res.json({
      success: true,
      data: datosNormalizados,
    });
  } catch (error) {
    console.error("Error en obtenerComunicados Controller:", error.message);
    next(error);
  }
};

exports.crearComunicado = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?.id_usuario || req.user?.userId || 1;
    const resultado = await notificacionesService.crearComunicado(req.body, adminId);
    
    return res.status(201).json({
      success: true,
      message: resultado.message || "Comunicado emitido correctamente.",
      ...resultado
    });
  } catch (error) {
    console.error("Error en crearComunicado Controller:", error.message);
    next(error);
  }
};

exports.desactivarComunicado = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resultado = await notificacionesService.desactivarComunicado(id);
    
    return res.json({
      success: true,
      message: resultado.message || "Comunicado inactivado con éxito.",
      ...resultado
    });
  } catch (error) {
    console.error("Error en desactivarComunicado Controller:", error.message);
    next(error);
  }
};

exports.marcarComunicadoLeido = async (req, res, next) => {
  try {
    const resultado = await notificacionesService.marcarComunicadoLeido(req.params.id, req.user);
    return res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};