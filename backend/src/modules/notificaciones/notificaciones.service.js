const oracledb = require("oracledb");
const db = require("../../config/db");
const {
  TIPOS_DESTINATARIO,
  normalizarRol,
  normalizarTipoDestinatario,
  parseBoolean,
  toPositiveNumber,
  resolverRolDestino,
  listarUsuariosDestino,
  obtenerDestinatarios,
  enviarNotificaciones,
} = require("../../utils/recipients.service");

const CANALES_VALIDOS = ["APP", "EMAIL", "WHATSAPP", "AMBOS", "TODOS"];

function crearError(mensaje, statusCode = 400, code = "VALIDATION_ERROR") {
  const error = new Error(mensaje);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * Obtiene los comunicados visibles para el usuario autenticado.
 * - ADMINISTRADOR / ADMIN: ve todo el histórico.
 * - GARITA: ve comunicados globales, para garita y los dirigidos a su usuario.
 * - CONDOMINO / RESIDENTE: ve globales, para condóminos y los dirigidos a su usuario.
 */
exports.obtenerComunicados = async (user) => {
  const rol = normalizarRol(user?.rol || user?.role);
  const casaId = toPositiveNumber(user?.casaId || user?.id_casa);
  const userId = toPositiveNumber(user?.id || user?.id_usuario || user?.userId);

  const columnas = `
    c.id_comunicado,
    c.id_usuario,
    c.id_casa_destino,
    c.id_usuario_destino,
    c.tipo_destinatario,
    c.rol_destino,
    c.titulo,
    c.contenido,
    c.canal_envio,
    c.enviar_whatsapp,
    c.fecha_publicacion,
    c.fecha_vencimiento,
    c.estado,
    u.nombre_usuario AS autor,
    cs.numero_casa,
    pd.nombres || ' ' || pd.apellidos AS destinatario_usuario`;

  const joins = `
    FROM COMUNICADO c
    LEFT JOIN USUARIO u ON c.id_usuario = u.id_usuario
    LEFT JOIN CASA cs ON c.id_casa_destino = cs.id_casa
    LEFT JOIN USUARIO ud ON c.id_usuario_destino = ud.id_usuario
    LEFT JOIN PERSONA pd ON ud.id_persona = pd.id_persona`;

  try {
    if (["ADMIN", "ADMINISTRADOR"].includes(rol)) {
      const result = await db.executeQuery(
        `SELECT ${columnas} ${joins} ORDER BY c.fecha_publicacion DESC`,
        {}
      );
      return result.rows || [];
    }

    const esGarita = rol === "GARITA";
    const tiposVisibles = esGarita
      ? `'TODOS', 'GARITA'`
      : `'TODOS', 'CONDOMINOS'`;

    const sql = `
      SELECT ${columnas}
      ${joins}
      WHERE c.estado = 'ACTIVO'
        AND (c.id_casa_destino IS NULL OR c.id_casa_destino = :casaId)
        AND (
          c.tipo_destinatario IS NULL
          OR c.tipo_destinatario IN (${tiposVisibles})
          OR (c.tipo_destinatario = 'ESPECIFICO' AND c.id_usuario_destino = :userId)
        )
      ORDER BY c.fecha_publicacion DESC`;

    const result = await db.executeQuery(sql, {
      casaId: casaId || null,
      userId: userId || null,
    });

    return result.rows || [];
  } catch (error) {
    console.error("Error al consultar comunicados:", error.message);
    throw error;
  }
};

/**
 * Registra un aviso/circular y despacha las notificaciones secundarias.
 */
exports.crearComunicado = async (datos = {}, usuario = {}) => {
  const user = typeof usuario === "object" && usuario !== null
    ? usuario
    : { id: usuario, rol: "ADMINISTRADOR" };

  const autorId = toPositiveNumber(user.id || user.userId || user.id_usuario);
  const rolAutor = normalizarRol(user.rol || user.role);

  const titulo = String(datos.titulo || "").trim();
  const contenido = String(datos.contenido || "").trim();

  if (!titulo || !contenido) {
    throw crearError("El título y el contenido del comunicado son requeridos.");
  }

  const idUsuarioDestino = toPositiveNumber(
    datos.idUsuarioDestino ?? datos.id_usuario_destino
  );
  const idCasaDestino = toPositiveNumber(
    datos.idCasaDestino ?? datos.id_casa_destino
  );

  const tipoDestinatario = normalizarTipoDestinatario(
    datos.tipoDestinatario ?? datos.tipo_destinatario,
    idUsuarioDestino ? TIPOS_DESTINATARIO.ESPECIFICO : TIPOS_DESTINATARIO.TODOS
  );

  if (
    tipoDestinatario === TIPOS_DESTINATARIO.ESPECIFICO &&
    !idUsuarioDestino
  ) {
    throw crearError("Debe seleccionar el usuario específico que recibirá el aviso.");
  }

  if (
    ["ADMIN", "ADMINISTRADOR"].includes(rolAutor) &&
    tipoDestinatario === TIPOS_DESTINATARIO.ADMINISTRADOR
  ) {
    throw crearError(
      "El administrador no puede enviarse un aviso a sí mismo. Seleccione otro destinatario."
    );
  }

  const rolDestino =
    normalizarRol(datos.rolDestino ?? datos.rol_destino) ||
    (await resolverRolDestino(tipoDestinatario, idUsuarioDestino));

  const canalSolicitado = String(datos.canalEnvio ?? datos.canal_envio ?? "APP")
    .trim()
    .toUpperCase();
  const canalEnvio = CANALES_VALIDOS.includes(canalSolicitado)
    ? canalSolicitado
    : "APP";
  const enviarWhatsAppFlag = parseBoolean(
    datos.enviarWhatsApp ?? datos.enviar_whatsapp
  );

  const sqlInsert = `
    INSERT INTO COMUNICADO
      (
        id_usuario,
        id_casa_destino,
        id_usuario_destino,
        tipo_destinatario,
        rol_destino,
        titulo,
        contenido,
        canal_envio,
        enviar_whatsapp,
        fecha_vencimiento
      )
    VALUES
      (
        :autorId,
        :idCasaDestino,
        :idUsuarioDestino,
        :tipoDestinatario,
        :rolDestino,
        :titulo,
        :contenido,
        :canalEnvio,
        :enviarWhatsApp,
        CASE WHEN :fechaVenc IS NOT NULL THEN TO_DATE(:fechaVenc, 'YYYY-MM-DD') ELSE NULL END
      )
    RETURNING id_comunicado INTO :idComunicadoOut`;

  const bindParams = {
    autorId: autorId || 1,
    idCasaDestino,
    idUsuarioDestino,
    tipoDestinatario,
    rolDestino,
    titulo,
    contenido,
    canalEnvio,
    enviarWhatsApp: enviarWhatsAppFlag ? "SI" : "NO",
    fechaVenc: datos.fechaVencimiento || datos.fecha_vencimiento || null,
    idComunicadoOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
  };

  const resultado = await db.executeQuery(sqlInsert, bindParams, {
    autoCommit: true,
  });

  const idComunicado = resultado.outBinds?.idComunicadoOut?.[0] || null;

  let notificaciones = null;
  const requiereEnvio =
    enviarWhatsAppFlag ||
    ["EMAIL", "WHATSAPP", "AMBOS", "TODOS"].includes(canalEnvio);

  if (requiereEnvio) {
    try {
      const destinatarios = await obtenerDestinatarios({
        tipoDestinatario,
        rolDestino,
        idUsuarioDestino,
      });

      notificaciones = await enviarNotificaciones({
        destinatarios,
        titulo,
        contenido,
        canalEnvio,
        enviarWhatsApp: enviarWhatsAppFlag,
        origen: "COMUNICADO",
      });
    } catch (errorNotificacion) {
      // Un fallo de email/WhatsApp nunca debe revertir el aviso ya guardado.
      console.log(
        `[Comunicados] El aviso ${idComunicado} se guardó, pero falló el despacho de notificaciones: ${errorNotificacion.message}`
      );
    }
  }

  return {
    idComunicado,
    tipoDestinatario,
    rolDestino,
    canalEnvio,
    enviarWhatsApp: enviarWhatsAppFlag,
    notificaciones,
    message: "Comunicado emitido y notificaciones procesadas correctamente.",
  };
};

/**
 * Marca un comunicado como INACTIVO.
 */
exports.desactivarComunicado = async (idComunicado) => {
  const id = toPositiveNumber(idComunicado);
  if (!id) throw crearError("El identificador del comunicado no es válido.");

  await db.executeQuery(
    `UPDATE COMUNICADO SET estado = 'INACTIVO' WHERE id_comunicado = :idComunicado`,
    { idComunicado: id },
    { autoCommit: true }
  );

  return { message: "Comunicado inactivado con éxito." };
};

/**
 * Catálogo de usuarios disponibles para el selector de destinatario.
 */
exports.obtenerUsuariosDestino = async () => listarUsuariosDestino();
