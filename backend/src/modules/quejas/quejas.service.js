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
 * Lista las quejas visibles para el usuario.
 * - ADMINISTRADOR / GARITA: todas.
 * - CONDOMINO / RESIDENTE: únicamente las creadas por él o dirigidas a él.
 */
exports.listarQuejas = async (user) => {
  const rol = normalizarRol(user?.rol || user?.role);
  const userId = toPositiveNumber(user?.id || user?.id_usuario || user?.userId);

  const sql = `
    SELECT
      q.id_queja,
      q.id_usuario,
      q.id_casa,
      q.id_usuario_destino,
      q.tipo_destinatario,
      q.rol_destino,
      q.asunto,
      q.descripcion,
      q.fecha_creacion,
      q.estado,
      q.respuesta,
      q.fecha_respuesta,
      q.enviar_whatsapp,
      u.nombre_usuario AS usuario_reporta,
      p.nombres || ' ' || p.apellidos AS nombre_reporta,
      c.numero_casa,
      pd.nombres || ' ' || pd.apellidos AS destinatario_usuario
    FROM QUEJA q
    LEFT JOIN USUARIO u ON q.id_usuario = u.id_usuario
    LEFT JOIN PERSONA p ON u.id_persona = p.id_persona
    LEFT JOIN CASA c ON q.id_casa = c.id_casa
    LEFT JOIN USUARIO ud ON q.id_usuario_destino = ud.id_usuario
    LEFT JOIN PERSONA pd ON ud.id_persona = pd.id_persona
    ${
      ["ADMIN", "ADMINISTRADOR", "GARITA"].includes(rol)
        ? ""
        : "WHERE q.id_usuario = :userId OR q.id_usuario_destino = :userId"
    }
    ORDER BY q.fecha_creacion DESC`;

  const result = await db.executeQuery(
    sql,
    ["ADMIN", "ADMINISTRADOR", "GARITA"].includes(rol)
      ? {}
      : { userId: userId || -1 }
  );

  return result.rows || [];
};

/**
 * Registra una queja o sugerencia. Cualquier usuario autenticado puede crear
 * una, independientemente de su rol.
 */
exports.crearQueja = async (datos = {}, user = {}) => {
  const userId = toPositiveNumber(user.id || user.userId || user.id_usuario);
  if (!userId) {
    throw crearError("No se pudo identificar al usuario autenticado.", 401, "UNAUTHORIZED");
  }

  const rolAutor = normalizarRol(user.rol || user.role);
  const esAdministrador = ["ADMIN", "ADMINISTRADOR"].includes(rolAutor);

  const asunto = String(
    datos.asunto ?? datos.titulo ?? ""
  ).trim();
  const descripcion = String(
    datos.descripcion ?? datos.contenido ?? ""
  ).trim();

  if (!asunto || !descripcion) {
    throw crearError("El asunto y la descripción de la queja son requeridos.");
  }

  const idUsuarioDestino = toPositiveNumber(
    datos.idUsuarioDestino ?? datos.id_usuario_destino
  );

  const tipoDestinatario = normalizarTipoDestinatario(
    datos.tipoDestinatario ?? datos.tipo_destinatario,
    esAdministrador ? TIPOS_DESTINATARIO.CONDOMINOS : TIPOS_DESTINATARIO.ADMINISTRADOR
  );

  if (
    tipoDestinatario === TIPOS_DESTINATARIO.ESPECIFICO &&
    !idUsuarioDestino
  ) {
    throw crearError("Debe seleccionar el usuario específico que recibirá la queja.");
  }

  if (
    esAdministrador &&
    tipoDestinatario === TIPOS_DESTINATARIO.ADMINISTRADOR
  ) {
    throw crearError(
      "El administrador no puede enviarse una queja a sí mismo. Seleccione otro destinatario."
    );
  }

  const rolDestino =
    normalizarRol(datos.rolDestino ?? datos.rol_destino) ||
    (await resolverRolDestino(tipoDestinatario, idUsuarioDestino));

  const idCasa =
    toPositiveNumber(datos.idCasa ?? datos.id_casa) ||
    toPositiveNumber(user.casaId || user.id_casa);

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
    INSERT INTO QUEJA
      (
        id_usuario,
        id_casa,
        id_usuario_destino,
        tipo_destinatario,
        rol_destino,
        asunto,
        descripcion,
        canal_envio,
        enviar_whatsapp
      )
    VALUES
      (
        :idUsuario,
        :idCasa,
        :idUsuarioDestino,
        :tipoDestinatario,
        :rolDestino,
        :asunto,
        :descripcion,
        :canalEnvio,
        :enviarWhatsApp
      )
    RETURNING id_queja INTO :idQuejaOut`;

  const resultado = await db.executeQuery(
    sqlInsert,
    {
      idUsuario: userId,
      idCasa,
      idUsuarioDestino,
      tipoDestinatario,
      rolDestino,
      asunto,
      descripcion,
      canalEnvio,
      enviarWhatsApp: enviarWhatsAppFlag ? "SI" : "NO",
      idQuejaOut: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    },
    { autoCommit: true }
  );

  const idQueja = resultado.outBinds?.idQuejaOut?.[0] || null;

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
        titulo: asunto,
        contenido: descripcion,
        canalEnvio,
        enviarWhatsApp: enviarWhatsAppFlag,
        origen: "QUEJA",
      });
    } catch (errorNotificacion) {
      // La queja ya quedó guardada; un fallo externo no debe revertirla.
      console.log(
        `[Quejas] La queja ${idQueja} se guardó, pero falló el despacho de notificaciones: ${errorNotificacion.message}`
      );
    }
  }

  return {
    idQueja,
    tipoDestinatario,
    rolDestino,
    canalEnvio,
    enviarWhatsApp: enviarWhatsAppFlag,
    notificaciones,
    message: "Queja o sugerencia registrada correctamente.",
  };
};

/**
 * Catálogo de usuarios para el selector de destinatario específico.
 */
exports.obtenerUsuariosDestino = async () => listarUsuariosDestino();
