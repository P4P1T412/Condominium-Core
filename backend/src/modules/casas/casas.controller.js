/**
 * =============================================================================
 * CONTROLADOR: GESTIÓN DE CASAS
 * =============================================================================
 */

const casasService = require("./casas.service");

async function getCasas(req, res, next) {
  try {
    const { estado, bloque } = req.query;
    const casas = await casasService.getAllCasas({ estado, bloque });
    return res.status(200).json({ success: true, data: casas });
  } catch (error) {
    next(error);
  }
}

async function getCasa(req, res, next) {
  try {
    const { id } = req.params;
    const casa = await casasService.getCasaById(Number(id));
    return res.status(200).json({ success: true, data: casa });
  } catch (error) {
    next(error);
  }
}

async function createCasa(req, res, next) {
  try {
    const { numeroCasa, bloque, direccion, idPropietario, estado } = req.body;

    // Permitimos idPropietario opcional si la casa está disponible/en venta
    if (!numeroCasa || !bloque || !direccion) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Los campos número de casa, bloque y dirección son obligatorios.",
      });
    }

    const result = await casasService.createCasa(req.body, req.user.userId);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function addResidente(req, res, next) {
  try {
    const { id } = req.params;
    const { idPersona, tipoResidente, esPrincipal } = req.body;

    if (!idPersona) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Debe especificar el identificador de la persona a vincular.",
      });
    }

    const result = await casasService.addResidenteToCasa(Number(id), {
      idPersona,
      tipoResidente,
      esPrincipal,
    });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

// Obtiene el catálogo de personas usando la capa de servicio
async function getPersonas(req, res, next) {
  try {
    const personas = await casasService.getPersonas();
    return res.status(200).json({
      success: true,
      data: personas,
    });
  } catch (error) {
    next(error);
  }
}

// Actualiza la vivienda delegando en la capa de servicio
async function updateCasa(req, res, next) {
  try {
    const { id } = req.params;
    const { numeroCasa, bloque, direccion, estado, idPropietario } = req.body;

    if (!numeroCasa || !bloque || !direccion) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Número de casa, bloque y dirección son obligatorios.",
      });
    }

    const result = await casasService.updateCasa(id, {
      numeroCasa,
      bloque,
      direccion,
      estado,
      idPropietario,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

async function createPersona(req, res, next) {
  try {
    const { nombres, apellidos, dpi, telefono, correo } = req.body;

    if (!nombres || !apellidos) {
      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Nombres y apellidos son obligatorios.",
      });
    }

    const nuevaPersona = await casasService.createPersona(req.body);
    return res.status(201).json({
      success: true,
      message: "Persona registrada exitosamente.",
      data: nuevaPersona,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCasas,
  getCasa,
  createCasa,
  addResidente,
  getPersonas,
  updateCasa,
  createPersona,
};