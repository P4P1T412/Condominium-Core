const { executeQuery } = require("../../config/db");

/**
 * Obtener listado de quejas y sugerencias
 */
async function obtenerQuejas(req, res, next) {
  try {
    const rolUpper = String(req.user?.rol || req.user?.role || "").toUpperCase();
    const idUsuario = req.user?.id_usuario || req.user?.id || req.user?.sub;
    const idCasa = req.user?.id_casa || req.user?.casaId;

    let query = "";
    let bindParams = {};

    // Si es Condómino/Residente, filtrar por sus identificadores correspondientes
    if (rolUpper.includes("RESIDENTE") || rolUpper.includes("CONDOMINO")) {
      query = `
        SELECT 
          q.id_queja,
          q.asunto,
          q.descripcion,
          q.origen,
          q.id_usuario,
          q.id_usuario_registra,
          q.estado,
          q.respuesta,
          q.fecha_creacion,
          q.fecha_respuesta,
          q.id_casa,
          c.numero_casa,
          NVL(TRIM(p_reporta.nombres || ' ' || p_reporta.apellidos),
            CASE WHEN q.id_usuario IS NULL THEN 'Residente no identificado' ELSE u_reporta.nombre_usuario END) AS autor,
          u_registra.nombre_usuario AS registrado_por
        FROM QUEJA q
        LEFT JOIN CASA c ON q.id_casa = c.id_casa
        LEFT JOIN USUARIO u_reporta ON q.id_usuario = u_reporta.id_usuario
        LEFT JOIN PERSONA p_reporta ON u_reporta.id_persona = p_reporta.id_persona
        LEFT JOIN USUARIO u_registra ON q.id_usuario_registra = u_registra.id_usuario
        WHERE (:idUsuario <> 0 AND q.id_usuario = :idUsuario)
           OR (:idCasa <> 0 AND q.id_casa = :idCasa)
        ORDER BY q.fecha_creacion DESC
      `;
      bindParams = {
        idUsuario: idUsuario ? Number(idUsuario) : 0,
        idCasa: idCasa ? Number(idCasa) : 0,
      };
    } else {
      // Para administración y garita: listar todas las quejas del condominio
      query = `
        SELECT 
          q.id_queja,
          q.asunto,
          q.descripcion,
          q.origen,
          q.id_usuario,
          q.id_usuario_registra,
          q.estado,
          q.respuesta,
          q.fecha_creacion,
          q.fecha_respuesta,
          q.id_casa,
          c.numero_casa,
          NVL(TRIM(p_reporta.nombres || ' ' || p_reporta.apellidos),
            CASE WHEN q.id_usuario IS NULL THEN 'Residente no identificado' ELSE u_reporta.nombre_usuario END) AS autor,
          u_registra.nombre_usuario AS registrado_por
        FROM QUEJA q
        LEFT JOIN CASA c ON q.id_casa = c.id_casa
        LEFT JOIN USUARIO u_reporta ON q.id_usuario = u_reporta.id_usuario
        LEFT JOIN PERSONA p_reporta ON u_reporta.id_persona = p_reporta.id_persona
        LEFT JOIN USUARIO u_registra ON q.id_usuario_registra = u_registra.id_usuario
        ORDER BY q.fecha_creacion DESC
      `;
    }

    const result = await executeQuery(query, bindParams);
    const rawRows = result.rows || result.data || result || [];

    // Mapeo seguro y tolerante a diferencias de minúsculas/mayúsculas de Oracle DB
    const quejasFormateadas = rawRows.map((row) => {
      const id = row.ID_QUEJA || row.id_queja || row.ID || row.id;
      const asunto = row.ASUNTO || row.asunto;
      const descripcion = row.DESCRIPCION || row.descripcion;
      const origen = row.ORIGEN || row.origen || "PORTAL";
      const estado = row.ESTADO || row.estado || "PENDIENTE";
      const respuesta = row.RESPUESTA || row.respuesta || null;
      const fechaCreacion = row.FECHA_CREACION || row.fecha_creacion;
      const fechaRespuesta = row.FECHA_RESPUESTA || row.fecha_respuesta || null;
      const numCasa = row.NUMERO_CASA || row.numero_casa || row.ID_CASA || row.id_casa;
      const autor = row.AUTOR || row.autor || "Residente no identificado";
      const registradoPor = row.REGISTRADO_POR || row.registrado_por || autor;

      return {
        id,
        asunto,
        descripcion,
        origen,
        idUsuarioReporta: row.ID_USUARIO ?? row.id_usuario ?? null,
        reportante: autor,
        registradoPor,
        estado,
        respuesta,
        fechaCreacion,
        fechaRespuesta,
        casa: numCasa ? `Casa #${numCasa}` : "General",
        autor,
      };
    });

    return res.json(quejasFormateadas);
  } catch (error) {
    console.error("Error en obtenerQuejas:", error);
    next(error);
  }
}

/**
 * Crear nueva queja o sugerencia
 */
async function crearQueja(req, res, next) {
  try {
    const { asunto, descripcion, idCasa } = req.body;
    const idUsuario = req.user?.id_usuario || req.user?.id || req.user?.sub;
    const rolUpper = String(req.user?.rol || req.user?.role || "").toUpperCase();
    const esAdmin = rolUpper.includes("ADMIN");
    const origenSolicitado = String(req.body?.origen || "PORTAL").toUpperCase();
    const origenesValidos = ["PORTAL", "PRESENCIAL", "TELEFONO", "CORREO", "WHATSAPP", "OTRO"];
    const origen = esAdmin ? origenSolicitado : "PORTAL";
    let reportanteId = esAdmin ? (req.body?.idUsuarioReporta ? Number(req.body.idUsuarioReporta) : null) : Number(idUsuario);
    let casaFinal = Number(req.body?.idCasa || req.user?.id_casa || req.user?.casaId || 0) || null;

    if (!asunto || !descripcion) {
      return res.status(400).json({
        success: false,
        message: "El asunto y la descripción son obligatorios.",
      });
    }

    if (!origenesValidos.includes(origen)) {
      return res.status(400).json({ success: false, message: "Selecciona un origen válido para la queja." });
    }

    if (esAdmin && reportanteId) {
      const reportanteResult = await executeQuery(`
        SELECT u.id_usuario, r.nombre AS nombre_rol,
          NVL(
            (SELECT c.id_casa FROM CASA c WHERE c.id_propietario = p.id_persona AND ROWNUM = 1),
            (SELECT c.id_casa FROM RESIDENTE rr JOIN CASA c ON c.id_casa = rr.id_casa
             WHERE rr.id_persona = p.id_persona AND rr.estado = 'ACTIVO' AND ROWNUM = 1)
          ) AS id_casa
        FROM USUARIO u
        JOIN ROL r ON r.id_rol = u.id_rol
        JOIN PERSONA p ON p.id_persona = u.id_persona
        WHERE u.id_usuario = :idUsuario AND u.estado = 'ACTIVO'
      `, { idUsuario: reportanteId });
      const reportante = reportanteResult.rows?.[0];
      const rolReportante = String(reportante?.NOMBRE_ROL || reportante?.nombre_rol || "").toUpperCase();
      if (!reportante || !["CONDOMINO", "CONDÓMINO", "RESIDENTE"].includes(rolReportante)) {
        return res.status(400).json({ success: false, message: "Selecciona una cuenta activa de condómino o residente." });
      }
      casaFinal = Number(reportante.ID_CASA ?? reportante.id_casa) || null;
      if (!casaFinal) {
        return res.status(400).json({ success: false, message: "El reportante no tiene una casa asociada." });
      }
    } else if (esAdmin) {
      reportanteId = null;
    } else {
      casaFinal = Number(idCasa) || casaFinal;
    }

    const registradorId = Number(idUsuario);
    if (!casaFinal || !registradorId) {
      return res.status(400).json({ success: false, message: "Debe asociarse la queja a una casa válida." });
    }

    const query = `
      INSERT INTO QUEJA (id_usuario, id_usuario_registra, id_casa, asunto, descripcion, origen, estado, fecha_creacion)
      VALUES (:idUsuario, :idUsuarioRegistra, :casaFinal, :asunto, :descripcion, :origen, 'PENDIENTE', SYSDATE)
    `;

    await executeQuery(query, {
      idUsuario: reportanteId,
      idUsuarioRegistra: registradorId,
      casaFinal,
      asunto,
      descripcion,
      origen,
    }, { autoCommit: true });

    return res.status(201).json({
      success: true,
      message: "Queja o sugerencia registrada correctamente.",
    });
  } catch (error) {
    console.error("Error en crearQueja:", error);
    next(error);
  }
}

/**
 * Responder queja (Administración)
 */
async function responderQueja(req, res, next) {
  try {
    const { id } = req.params;
    const { respuesta, estado } = req.body;

    const query = `
      UPDATE QUEJA
      SET respuesta = :respuesta,
          estado = :estado,
          fecha_respuesta = SYSDATE
      WHERE id_queja = :id
    `;

    await executeQuery(query, {
      respuesta,
      estado: estado || "RESUELTA",
      id: Number(id),
    }, { autoCommit: true });

    return res.json({
      success: true,
      message: "Respuesta registrada correctamente.",
    });
  } catch (error) {
    console.error("Error en responderQueja:", error);
    next(error);
  }
}

module.exports = {
  obtenerQuejas,
  crearQueja,
  responderQueja,
};