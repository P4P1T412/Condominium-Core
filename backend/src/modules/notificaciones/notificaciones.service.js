const db = require("../../config/db");
const { sendEmail } = require("../../utils/email.service");
const { sendWhatsApp } = require("../../utils/whatsapp.service");

/**
 * Obtiene la lista de comunicados filtrando según el rol del usuario.
 * Soporta roles 'CONDOMINO' y 'RESIDENTE', además de 'ADMIN' / 'GARITA'.
 */
exports.obtenerComunicados = async (user) => {
  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const casaIdSafe = user?.casaId || user?.id_casa || null;
  const userIdSafe = user?.id || user?.id_usuario || null;

  try {
    if (rolUpper === "RESIDENTE" || rolUpper === "CONDOMINO") {
      const sql = `
        SELECT 
          c.id_comunicado,
          c.titulo,
          c.contenido,
          c.canal_envio,
          c.fecha_publicacion,
          c.estado,
          u.nombre_usuario AS autor
        FROM COMUNICADO c
        LEFT JOIN USUARIO u ON c.id_usuario = u.id_usuario
        WHERE c.estado = 'ACTIVO'
          AND (
            (c.id_casa_destino IS NULL)
            OR (c.id_casa_destino = :casaId)
          )
        ORDER BY c.fecha_publicacion DESC`;

      const result = await db.executeQuery(sql, { casaId: casaIdSafe ? Number(casaIdSafe) : null });
      return result.rows || result.data || result || [];
    }

    // Vista para Administrador / Garita (muestra todo el histórico)
    const sql = `
      SELECT 
        c.id_comunicado,
        c.titulo,
        c.contenido,
        c.canal_envio,
        c.fecha_publicacion,
        c.estado,
        c.id_casa_destino,
        u.nombre_usuario AS autor,
        cs.numero_casa
      FROM COMUNICADO c
      LEFT JOIN USUARIO u ON c.id_usuario = u.id_usuario
      LEFT JOIN CASA cs ON c.id_casa_destino = cs.id_casa
      ORDER BY c.fecha_publicacion DESC`;

    const result = await db.executeQuery(sql, {});
    return result.rows || result.data || result || [];
  } catch (error) {
    console.error("Aviso: Error en consulta de comunicados (defensivo):", error.message);
    return []; // Responde con array vacío para evitar un error 500 en el frontend
  }
};

/**
 * Registra un comunicado en Oracle DB (Buzón de quejas / avisos) y gestiona el envío multicanal.
 */
exports.crearComunicado = async (datos, adminId) => {
  const {
    titulo,
    contenido,
    idCasaDestino,
    idUsuarioDestino,
    canalEnvio,
    fechaVencimiento
  } = datos;

  // Manejo de fecha opcional sin romper TO_DATE de Oracle
  const sqlInsert = `
    INSERT INTO COMUNICADO 
      (id_usuario, id_casa_destino, titulo, contenido, canal_envio, fecha_vencimiento)
    VALUES 
      (:adminId, :idCasa, :titulo, :contenido, :canal, 
       CASE WHEN :fechaVenc IS NOT NULL THEN TO_DATE(:fechaVenc, 'YYYY-MM-DD') ELSE NULL END)`;

  const bindParams = {
    adminId: Number(adminId || 1),
    idCasa: idCasaDestino ? Number(idCasaDestino) : null,
    titulo: String(titulo),
    contenido: String(contenido),
    canal: canalEnvio || "APP",
    fechaVenc: fechaVencimiento || null
  };

  await db.executeQuery(sqlInsert, bindParams);

  // Despacho de notificaciones por Email / WhatsApp si aplica
  if (canalEnvio && canalEnvio !== "APP") {
    try {
      let sqlDestinatarios = `
        SELECT p.correo, p.telefono, u.nombre_usuario 
        FROM USUARIO u
        JOIN PERSONA p ON u.id_persona = p.id_persona
        WHERE u.es_verificado = 'SI'`;

      const queryParams = {};

      if (idUsuarioDestino) {
        sqlDestinatarios += ` AND u.id_usuario = :idUsuario`;
        queryParams.idUsuario = Number(idUsuarioDestino);
      }

      const resDest = await db.executeQuery(sqlDestinatarios, queryParams);
      const usuarios = resDest.rows || resDest.data || resDest || [];

      for (const usr of usuarios) {
        const correo = usr.CORREO || usr.correo;
        const telefono = usr.TELEFONO || usr.telefono;

        // Envío por correo electrónico
        if (["EMAIL", "AMBOS", "TODOS"].includes(canalEnvio) && correo) {
          sendEmail({
            to: correo,
            subject: `[Aviso Condominio] ${titulo}`,
            text: contenido,
            html: `<h3>${titulo}</h3><p>${contenido}</p>`
          }).catch((err) => console.error(`Error enviando email a ${correo}:`, err));
        }

        // Envío por WhatsApp
        if (["WHATSAPP", "AMBOS", "TODOS"].includes(canalEnvio) && telefono) {
          sendWhatsApp({
            to: telefono,
            message: `*Aviso Importante - Condominio*\n\n*${titulo}*\n${contenido}`
          }).catch((err) => console.error(`Error enviando WhatsApp a ${telefono}:`, err));
        }
      }
    } catch (errNotif) {
      console.error("Error al procesar envíos secundarios de notificaciones:", errNotif.message);
    }
  }

  return {
    message: "Comunicado emitido y notificaciones procesadas correctamente."
  };
};

/**
 * Marca un comunicado como INACTIVO en la base de datos.
 */
exports.desactivarComunicado = async (idComunicado) => {
  const sql = `UPDATE COMUNICADO SET estado = 'INACTIVO' WHERE id_comunicado = :idComunicado`;
  await db.executeQuery(sql, { idComunicado: Number(idComunicado) });
  return { message: "Comunicado inactivado con éxito." };
};