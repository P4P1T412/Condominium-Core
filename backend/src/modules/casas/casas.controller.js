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

/**
 * Desvincula (baja lógica) a un residente de una vivienda.
 * Conserva el histórico del censo marcando el vínculo como INACTIVO.
 */
async function removeResidente(req, res, next) {
  try {
    const { id, idResidente } = req.params;

    const result = await casasService.removeResidenteFromCasa(
      Number(id),
      Number(idResidente)
    );

    return res.status(200).json({
      success: true,
      message: result.message,
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

/**
 * Procesa la carga masiva de viviendas desde un archivo Excel en memoria.
 * Responde 200 con el resumen detallado o 400 si el archivo es inválido/vacío.
 */
async function importarCasas(req, res, next) {
  try {
    const file =
      req.file ||
      (req.files && req.files.archivo && req.files.archivo[0]) ||
      (req.files && req.files.archivoExcel && req.files.archivoExcel[0]) ||
      null;

    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        code: "FILE_REQUIRED",
        message: "No se adjuntó ningún archivo Excel o el archivo está vacío.",
      });
    }

    const resumen = await casasService.importarCasasDesdeExcel(file.buffer, {
      userId: req.user ? req.user.userId : null,
      idPropietario: req.body ? req.body.idPropietario : null,
    });

    return res.status(200).json({
      success: true,
      message: `Carga masiva finalizada: ${resumen.creados} casa(s) creada(s), ${resumen.omitidos} omitida(s) y ${resumen.errores.length} con error.`,
      data: resumen,
    });
  } catch (error) {
    if (error && error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        code: error.code || "INVALID_EXCEL_FILE",
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * Descarga la plantilla oficial .xlsx para la carga masiva de casas.
 */
async function descargarPlantilla(req, res, next) {
  try {
    const buffer = casasService.generarPlantillaExcel();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla-carga-casas.xlsx"'
    );

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCasas,
  getCasa,
  createCasa,
  importarCasas,
  descargarPlantilla,
  addResidente,
  removeResidente,
  getPersonas,
  updateCasa,
  createPersona,
};