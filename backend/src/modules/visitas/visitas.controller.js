const visitasService = require("./visitas.service");

/**
 * Obtiene el listado de visitas según el rol del usuario autenticado
 */
exports.obtenerVisitas = async (req, res, next) => {
  try {
    const data = await visitasService.obtenerVisitas(req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Registra una solicitud de visita individual
 */
exports.crearVisitaIndividual = async (req, res, next) => {
  try {
    const resultado = await visitasService.crearVisitaIndividual(req.body, req.user);
    res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Aprueba una visita individual (Rol Administrador)
 */
exports.aprobarVisita = async (req, res, next) => {
  try {
    const { idVisita } = req.params;
    const resultado = await visitasService.aprobarVisita(idVisita);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Rechaza una visita individual (Rol Administrador)
 */
exports.rechazarVisita = async (req, res, next) => {
  try {
    const { idVisita } = req.params;
    const { motivoRechazo } = req.body;
    const resultado = await visitasService.rechazarVisita(idVisita, motivoRechazo);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Procesa la carga masiva de visitas a través de archivo Excel
 */
exports.procesarEventoMasivo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No se adjuntó ningún archivo Excel." });
    }
    const { nombreEvento, fechaEvento } = req.body;
    const resultado = await visitasService.procesarEventoMasivo(
      req.file.buffer,
      nombreEvento,
      fechaEvento,
      req.body, // Contiene tipoEvento, otroEvento, salon, etc.
      req.user
    );
    res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Configura y aprueba un evento masivo (Asigna Fecha, Salón y Parqueo Inicial)
 */
exports.aprobarEvento = async (req, res, next) => {
  try {
    const { idEvento } = req.params;
    const resultado = await visitasService.aprobarEvento(idEvento, req.body);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Envía un evento masivo configurado a la Garita (Rol Administrador)
 */
exports.enviarEventoAGarita = async (req, res, next) => {
  try {
    const { idEvento } = req.params;
    const resultado = await visitasService.enviarEventoAGarita(idEvento);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Rechaza un evento masivo completo (Rol Administrador)
 */
exports.rechazarEvento = async (req, res, next) => {
  try {
    const { idEvento } = req.params;
    const { motivoRechazo } = req.body;
    const resultado = await visitasService.rechazarEvento(idEvento, motivoRechazo);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Registro Masivo Express en Garita para todos los invitados de un Evento
 */
exports.registrarIngresoMasivo = async (req, res, next) => {
  try {
    const { idEvento } = req.params;
    const resultado = await visitasService.registrarIngresoMasivoEvento(idEvento, req.user);
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Registra proveedores o servicios técnicos externos
 */
exports.crearServicioExterno = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.id_usuario || 1;
    const resultado = await visitasService.crearServicioExterno(req.body, userId);
    res.status(201).json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Valida pases QR y registra movimientos de Entrada/Salida en Garita
 */
exports.registrarAccesoGarita = async (req, res, next) => {
  try {
    const { token, tipoMovimiento, observacion } = req.body;
    const userId = req.user?.id || req.user?.id_usuario || 1;
    const resultado = await visitasService.registrarAccesoGarita(
      token,
      tipoMovimiento,
      observacion,
      userId
    );
    res.json({ success: true, ...resultado });
  } catch (error) {
    next(error);
  }
};