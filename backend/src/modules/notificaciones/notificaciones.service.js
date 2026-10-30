const db = require("../../config/db");
const oracledb = require("oracledb");
const { sendEmail } = require("../../utils/email.service");
const { sendWhatsApp } = require("../../utils/whatsapp.service");

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map(Number)
    .filter((id) => Number.isSafeInteger(id) && id > 0))];
}

function createInBinds(ids, prefix) {
  const binds = {};
  const placeholders = ids.map((id, index) => {
    const name = `${prefix}${index}`;
    binds[name] = id;
    return `:${name}`;
  });
  return { placeholders: placeholders.join(", "), binds };
}

async function resolverDestinatarios(tipoDestino, idUsuarioDestino, idUsuariosDestino, idRolesDestino) {
  if (tipoDestino === "USUARIOS" || tipoDestino === "INDIVIDUAL") {
    const requestedIds = uniqueIds(tipoDestino === "INDIVIDUAL" ? idUsuarioDestino : idUsuariosDestino);
    if (requestedIds.length === 0) {
      const error = new Error("Selecciona al menos un usuario destinatario.");
      error.statusCode = 400;
      throw error;
    }

    const { placeholders, binds } = createInBinds(requestedIds, "userId");
    const result = await db.executeQuery(
      `SELECT id_usuario FROM USUARIO WHERE estado = 'ACTIVO' AND id_usuario IN (${placeholders})`,
      binds
    );
    const ids = uniqueIds((result.rows || []).map((row) => row.ID_USUARIO ?? row.id_usuario));
    if (ids.length !== requestedIds.length) {
      const error = new Error("Uno o más usuarios seleccionados no están activos.");
      error.statusCode = 400;
      throw error;
    }
    return ids;
  }

  if (tipoDestino === "ROLES") {
    const roleIds = uniqueIds(idRolesDestino);
    if (roleIds.length === 0) {
      const error = new Error("Selecciona al menos un rol destinatario.");
      error.statusCode = 400;
      throw error;
    }

    const { placeholders, binds } = createInBinds(roleIds, "roleId");
    const activeRolesResult = await db.executeQuery(
      `SELECT id_rol FROM ROL WHERE estado = 'ACTIVO' AND id_rol IN (${placeholders})`,
      binds
    );
    const activeRoleIds = uniqueIds((activeRolesResult.rows || []).map((row) => row.ID_ROL ?? row.id_rol));
    if (activeRoleIds.length !== roleIds.length) {
      const error = new Error("Uno o más roles seleccionados no están activos.");
      error.statusCode = 400;
      throw error;
    }

    const result = await db.executeQuery(
      `SELECT DISTINCT u.id_usuario
       FROM USUARIO u
       JOIN ROL r ON r.id_rol = u.id_rol
       WHERE u.estado = 'ACTIVO' AND r.estado = 'ACTIVO'
         AND u.id_rol IN (${placeholders})`,
      binds
    );
    const ids = uniqueIds((result.rows || []).map((row) => row.ID_USUARIO ?? row.id_usuario));
    if (ids.length === 0) {
      const error = new Error("Los roles seleccionados no tienen usuarios activos.");
      error.statusCode = 400;
      throw error;
    }
    return ids;
  }

  if (!["GLOBAL", "CASA"].includes(tipoDestino)) {
    const error = new Error("El alcance del destinatario no es válido.");
    error.statusCode = 400;
    throw error;
  }

  return [];
}

async function obtenerDestinatariosCanal(tipoDestino, idCasaDestino, recipientIds) {
  let sql = `
    SELECT DISTINCT p.correo, p.telefono, u.nombre_usuario
    FROM USUARIO u
    JOIN PERSONA p ON p.id_persona = u.id_persona
    WHERE u.estado = 'ACTIVO' AND u.es_verificado = 'SI'
  `;
  let binds = {};

  if (tipoDestino === "CASA") {
    sql += `
      AND (
        EXISTS (
          SELECT 1 FROM RESIDENTE r
          WHERE r.id_persona = p.id_persona
            AND r.id_casa = :idCasa AND r.estado = 'ACTIVO'
        )
        OR EXISTS (
          SELECT 1 FROM CASA c
          WHERE c.id_propietario = p.id_persona AND c.id_casa = :idCasa
        )
      )`;
    binds = { idCasa: Number(idCasaDestino) };
  } else if (tipoDestino === "USUARIOS" || tipoDestino === "ROLES" || tipoDestino === "INDIVIDUAL") {
    const { placeholders, binds: recipientBinds } = createInBinds(recipientIds, "recipientId");
    sql += ` AND u.id_usuario IN (${placeholders})`;
    binds = recipientBinds;
  }

  const result = await db.executeQuery(sql, binds);
  return result.rows || result.data || result || [];
}

/**
 * Obtiene la lista de comunicados de la base de datos.
 */
exports.obtenerComunicados = async (user) => {
  const rolUpper = String(user?.rol || user?.role || "").toUpperCase();
  const casaIdSafe = user?.casaId || user?.id_casa || null;
  const userIdSafe = user?.id_usuario || user?.id || user?.userId || user?.sub || null;

  try {
    const esAdmin = rolUpper.includes("ADMIN");
    const userId = userIdSafe ? Number(userIdSafe) : null;
    const sql = `
      SELECT
        c.id_comunicado,
        c.titulo,
        c.contenido,
        c.categoria,
        c.tipo_destino,
        NVL(c.prioridad, 'NORMAL') AS prioridad,
        NVL(c.canal_envio, 'APP') AS canal_envio,
        c.fecha_publicacion,
        c.fecha_vencimiento,
        NVL(c.estado, 'ACTIVO') AS estado,
        c.id_casa_destino,
        c.id_usuario_destino,
        u.nombre_usuario AS autor,
        cs.numero_casa,
        (SELECT LISTAGG(r.nombre, ', ') WITHIN GROUP (ORDER BY r.nombre)
         FROM COMUNICADO_DESTINATARIO_ROL dr
         JOIN ROL r ON r.id_rol = dr.id_rol
         WHERE dr.id_comunicado = c.id_comunicado) AS roles_destino,
        (SELECT COUNT(*) FROM COMUNICADO_LECTURA l
         WHERE l.id_comunicado = c.id_comunicado) AS total_lecturas,
        (SELECT MAX(l.fecha_lectura) FROM COMUNICADO_LECTURA l
         WHERE l.id_comunicado = c.id_comunicado AND l.id_usuario = :userId) AS fecha_lectura,
        CASE c.tipo_destino
          WHEN 'GLOBAL' THEN (SELECT COUNT(*) FROM USUARIO ux WHERE ux.estado = 'ACTIVO')
          WHEN 'CASA' THEN (
            SELECT COUNT(DISTINCT ux.id_usuario)
            FROM USUARIO ux
            JOIN PERSONA px ON px.id_persona = ux.id_persona
            WHERE ux.estado = 'ACTIVO'
              AND (
                EXISTS (SELECT 1 FROM RESIDENTE rx WHERE rx.id_persona = px.id_persona AND rx.id_casa = c.id_casa_destino AND rx.estado = 'ACTIVO')
                OR EXISTS (SELECT 1 FROM CASA cx WHERE cx.id_propietario = px.id_persona AND cx.id_casa = c.id_casa_destino)
              )
          )
          WHEN 'INDIVIDUAL' THEN 1
          WHEN 'USUARIOS' THEN (SELECT COUNT(*) FROM COMUNICADO_DESTINATARIO_USUARIO d WHERE d.id_comunicado = c.id_comunicado)
          WHEN 'ROLES' THEN (SELECT COUNT(*) FROM COMUNICADO_DESTINATARIO_USUARIO d WHERE d.id_comunicado = c.id_comunicado)
          ELSE 0
        END AS total_destinatarios
      FROM COMUNICADO c
      LEFT JOIN USUARIO u ON c.id_usuario = u.id_usuario
      LEFT JOIN CASA cs ON c.id_casa_destino = cs.id_casa
      WHERE :esAdmin = 1
        OR (
          c.estado = 'ACTIVO'
          AND (c.fecha_vencimiento IS NULL OR c.fecha_vencimiento >= TRUNC(SYSDATE))
          AND (
            c.tipo_destino = 'GLOBAL'
            OR (c.tipo_destino = 'CASA' AND c.id_casa_destino = :casaId)
            OR c.id_usuario_destino = :userId
            OR EXISTS (
              SELECT 1 FROM COMUNICADO_DESTINATARIO_USUARIO d
              WHERE d.id_comunicado = c.id_comunicado AND d.id_usuario = :userId
            )
          )
        )
      ORDER BY c.id_comunicado DESC`;
    const result = await db.executeQuery(sql, {
      userId,
      casaId: casaIdSafe ? Number(casaIdSafe) : null,
      esAdmin: esAdmin ? 1 : 0,
    });
    return result.rows || result.data || result || [];
  } catch (error) {
    console.error("Error en obtenerComunicados service:", error.message);
    return [];
  }
};

/**
 * Registra un comunicado en Oracle DB asegurando autoCommit: true
 */
exports.crearComunicado = async (datos, adminId) => {
  const {
    titulo,
    contenido,
    categoria,
    prioridad: prioridadSolicitada,
    tipoDestino: tipoDestinoSolicitado,
    idCasaDestino,
    idUsuarioDestino,
    idUsuariosDestino,
    idRolesDestino,
    canalEnvio,
    fechaVencimiento
  } = datos;

  const tipoDestino = tipoDestinoSolicitado || (idCasaDestino ? "CASA" : idUsuarioDestino ? "INDIVIDUAL" : "GLOBAL");
  const prioridad = String(prioridadSolicitada || "NORMAL").toUpperCase();
  if (!["NORMAL", "ALTA", "URGENTE"].includes(prioridad)) {
    const error = new Error("La prioridad seleccionada no es válida.");
    error.statusCode = 400;
    throw error;
  }
  const recipientIds = await resolverDestinatarios(
    tipoDestino,
    idUsuarioDestino,
    idUsuariosDestino,
    idRolesDestino
  );
  const roleIds = tipoDestino === "ROLES" ? uniqueIds(idRolesDestino) : [];

  const sqlInsert = `
    INSERT INTO COMUNICADO
      (id_usuario, id_casa_destino, id_usuario_destino, tipo_destino, titulo, contenido, categoria, prioridad, canal_envio, fecha_publicacion, estado, fecha_vencimiento)
    VALUES
      (:adminId, :idCasa, :idUsuarioDest, :tipoDestino, :titulo, :contenido, :categoria, :prioridad, :canal, SYSDATE, 'ACTIVO',
       CASE WHEN :fechaVenc IS NOT NULL THEN TO_DATE(:fechaVenc, 'YYYY-MM-DD') ELSE NULL END)
    RETURNING id_comunicado INTO :idComunicado`;

  const bindParams = {
    adminId: Number(adminId || 1),
    idCasa: tipoDestino === "CASA" && idCasaDestino ? Number(idCasaDestino) : null,
    idUsuarioDest: tipoDestino === "INDIVIDUAL" ? Number(idUsuarioDestino) : null,
    tipoDestino,
    titulo: String(titulo),
    contenido: String(contenido),
    categoria: categoria || "General",
    prioridad,
    canal: canalEnvio || "APP",
    fechaVenc: fechaVencimiento || null,
    idComunicado: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const idComunicado = await db.executeTransaction(async (connection) => {
    const result = await connection.execute(sqlInsert, bindParams);
    const newId = result.outBinds.idComunicado[0];
    if (recipientIds.length > 0) {
      await connection.executeMany(
        `INSERT INTO COMUNICADO_DESTINATARIO_USUARIO (id_comunicado, id_usuario) VALUES (:idComunicado, :idUsuario)`,
        recipientIds.map((idUsuario) => ({ idComunicado: newId, idUsuario }))
      );
    }
    if (roleIds.length > 0) {
      await connection.executeMany(
        `INSERT INTO COMUNICADO_DESTINATARIO_ROL (id_comunicado, id_rol) VALUES (:idComunicado, :idRol)`,
        roleIds.map((idRol) => ({ idComunicado: newId, idRol }))
      );
    }
    return newId;
  });

  // Despacho secundario
  if (canalEnvio && canalEnvio !== "APP") {
    try {
      const usuarios = await obtenerDestinatariosCanal(tipoDestino, idCasaDestino, recipientIds);

      for (const usr of usuarios) {
        const correo = usr.CORREO || usr.correo;
        const telefono = usr.TELEFONO || usr.telefono;

        if (["EMAIL", "AMBOS", "TODOS"].includes(canalEnvio) && correo) {
          sendEmail({
            to: correo,
            subject: `${prioridad === "URGENTE" ? "[URGENTE] " : ""}[Aviso Condominio] ${titulo}`,
            text: contenido,
            html: `<h3>${titulo}</h3><p>${contenido}</p>`
          }).catch((err) => console.error(`Error enviando email a ${correo}:`, err.message));
        }

        if (["WHATSAPP", "AMBOS", "TODOS"].includes(canalEnvio) && telefono) {
          sendWhatsApp({
            to: telefono,
            message: `*${prioridad === "URGENTE" ? "URGENTE - " : ""}Aviso Importante - Condominio*\n\n*${titulo}*\n${contenido}`
          }).catch((err) => console.error(`Error enviando WhatsApp a ${telefono}:`, err.message));
        }
      }
    } catch (errNotif) {
      console.error("Error al procesar envíos secundarios:", errNotif.message);
    }
  }

  return { idComunicado, message: "Comunicado emitido y notificaciones procesadas correctamente." };
};

/**
 * Marca un comunicado como INACTIVO
 */
exports.desactivarComunicado = async (idComunicado) => {
  const sql = `UPDATE COMUNICADO SET estado = 'INACTIVO' WHERE id_comunicado = :idComunicado`;
  await db.executeQuery(sql, { idComunicado: Number(idComunicado) }, { autoCommit: true });
  return { message: "Comunicado inactivado con éxito." };
};

exports.marcarComunicadoLeido = async (idComunicado, user) => {
  const userId = Number(user?.id_usuario || user?.id || user?.userId || user?.sub);
  const casaId = Number(user?.casaId || user?.id_casa) || null;
  const esAdmin = String(user?.rol || user?.role || "").toUpperCase().includes("ADMIN");

  const sql = `
    MERGE INTO COMUNICADO_LECTURA l
    USING (
      SELECT c.id_comunicado, :userId AS id_usuario
      FROM COMUNICADO c
      WHERE c.id_comunicado = :idComunicado
        AND c.estado = 'ACTIVO'
        AND (c.fecha_vencimiento IS NULL OR c.fecha_vencimiento >= TRUNC(SYSDATE))
        AND (
          :esAdmin = 1
          OR c.tipo_destino = 'GLOBAL'
          OR (c.tipo_destino = 'CASA' AND c.id_casa_destino = :casaId)
          OR c.id_usuario_destino = :userId
          OR EXISTS (
            SELECT 1 FROM COMUNICADO_DESTINATARIO_USUARIO d
            WHERE d.id_comunicado = c.id_comunicado AND d.id_usuario = :userId
          )
        )
    ) source
    ON (l.id_comunicado = source.id_comunicado AND l.id_usuario = source.id_usuario)
    WHEN NOT MATCHED THEN
      INSERT (id_comunicado, id_usuario, fecha_lectura)
      VALUES (source.id_comunicado, source.id_usuario, SYSDATE)`;

  const result = await db.executeQuery(sql, {
    idComunicado: Number(idComunicado),
    userId,
    casaId,
    esAdmin: esAdmin ? 1 : 0,
  }, { autoCommit: true });

  if (result.rowsAffected === 0) {
    const existing = await db.executeQuery(
      `SELECT fecha_lectura FROM COMUNICADO_LECTURA WHERE id_comunicado = :idComunicado AND id_usuario = :userId`,
      { idComunicado: Number(idComunicado), userId }
    );
    if (!existing.rows?.length) {
      const error = new Error("El aviso no existe o no está dirigido a este usuario.");
      error.statusCode = 404;
      throw error;
    }
  }

  return { message: "Aviso marcado como recibido." };
};