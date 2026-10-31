const { executeQuery } = require("../config/db");
const { sendEmail } = require("./email.service");
const { sendWhatsApp } = require("./whatsapp.service");

const TIPOS_DESTINATARIO = Object.freeze({
  TODOS: "TODOS",
  ADMINISTRADOR: "ADMINISTRADOR",
  CONDOMINOS: "CONDOMINOS",
  GARITA: "GARITA",
  ESPECIFICO: "ESPECIFICO",
});

const ROLES_POR_TIPO = Object.freeze({
  ADMINISTRADOR: ["ADMINISTRADOR", "ADMIN"],
  CONDOMINOS: ["CONDOMINO", "RESIDENTE"],
  GARITA: ["GARITA"],
});

const ALIAS_ROLES = Object.freeze({
  ADMIN: "ADMINISTRADOR",
  RESIDENTE: "CONDOMINO",
});

/**
 * Normaliza el rol recibido desde el JWT o desde el body.
 */
function normalizarRol(value) {
  const rol = String(value || "").trim().toUpperCase();
  return ALIAS_ROLES[rol] || rol;
}

/**
 * Acepta los nombres nuevos y los valores heredados que usaba el frontend
 * (GLOBAL, CASA, INDIVIDUAL) para no romper integraciones previas.
 */
function normalizarTipoDestinatario(value, fallback = TIPOS_DESTINATARIO.TODOS) {
  const tipo = String(value || "").trim().toUpperCase();
  const equivalencias = {
    GLOBAL: TIPOS_DESTINATARIO.TODOS,
    CASA: TIPOS_DESTINATARIO.CONDOMINOS,
    INDIVIDUAL: TIPOS_DESTINATARIO.ESPECIFICO,
    CONDOMINO: TIPOS_DESTINATARIO.CONDOMINOS,
    RESIDENTE: TIPOS_DESTINATARIO.CONDOMINOS,
    ADMIN: TIPOS_DESTINATARIO.ADMINISTRADOR,
  };

  const normalizado = equivalencias[tipo] || tipo;
  return Object.values(TIPOS_DESTINATARIO).includes(normalizado) ? normalizado : fallback;
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["SI", "SÍ", "TRUE", "1", "ON", "YES"].includes(
    String(value || "").trim().toUpperCase()
  );
}

function toPositiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numero = Number(value);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function rolesParaRol(rolDestino) {
  const rol = normalizarRol(rolDestino);
  if (!rol) return null;
  if (["ADMIN", "ADMINISTRADOR"].includes(rol)) return ROLES_POR_TIPO.ADMINISTRADOR;
  if (["CONDOMINO", "RESIDENTE", "CONDOMINOS"].includes(rol)) return ROLES_POR_TIPO.CONDOMINOS;
  if (rol === "GARITA") return ROLES_POR_TIPO.GARITA;
  return [rol];
}

/**
 * Rol que se guarda en la columna ROL_DESTINO para dejar trazabilidad del
 * envío, incluso cuando el destino se resuelve por tipo.
 */
async function resolverRolDestino(tipoDestinatario, idUsuarioDestino) {
  const tipo = normalizarTipoDestinatario(tipoDestinatario);

  if (tipo === TIPOS_DESTINATARIO.ADMINISTRADOR) return "ADMINISTRADOR";
  if (tipo === TIPOS_DESTINATARIO.CONDOMINOS) return "CONDOMINO";
  if (tipo === TIPOS_DESTINATARIO.GARITA) return "GARITA";
  if (tipo !== TIPOS_DESTINATARIO.ESPECIFICO || !idUsuarioDestino) return null;

  try {
    const result = await executeQuery(
      `SELECT r.nombre
         FROM USUARIO u
         JOIN ROL r ON u.id_rol = r.id_rol
        WHERE u.id_usuario = :idUsuario`,
      { idUsuario: idUsuarioDestino }
    );
    return normalizarRol(result.rows?.[0]?.NOMBRE) || null;
  } catch (error) {
    console.log(
      `[Destinatarios] No se pudo resolver el rol del usuario ${idUsuarioDestino}: ${error.message}`
    );
    return null;
  }
}

/**
 * Catálogo mínimo de usuarios activos para el combo "usuario específico".
 * No expone contraseñas, tokens ni datos sensibles.
 */
async function listarUsuariosDestino() {
  const sql = `
    SELECT
      u.id_usuario,
      u.nombre_usuario,
      p.nombres || ' ' || p.apellidos AS nombre_completo,
      p.correo,
      p.telefono,
      r.nombre AS rol,
      (
        SELECT c.numero_casa
          FROM RESIDENTE re
          JOIN CASA c ON re.id_casa = c.id_casa
         WHERE re.id_persona = p.id_persona
           AND re.estado = 'ACTIVO'
         ORDER BY re.es_principal DESC, re.fecha_ingreso DESC
         FETCH FIRST 1 ROWS ONLY
      ) AS numero_casa
    FROM USUARIO u
    JOIN PERSONA p ON u.id_persona = p.id_persona
    JOIN ROL r ON u.id_rol = r.id_rol
    WHERE u.estado = 'ACTIVO'
      AND u.es_verificado = 'SI'
    ORDER BY p.nombres ASC, p.apellidos ASC`;

  const result = await executeQuery(sql, {});

  return (result.rows || []).map((row) => ({
    idUsuario: row.ID_USUARIO,
    nombreUsuario: row.NOMBRE_USUARIO,
    nombreCompleto: row.NOMBRE_COMPLETO,
    correo: row.CORREO,
    telefono: row.TELEFONO,
    rol: row.ROL,
    numeroCasa: row.NUMERO_CASA || null,
  }));
}

/**
 * Obtiene los usuarios que deben recibir una comunicación según el filtro
 * seleccionado en el formulario.
 */
async function obtenerDestinatarios({
  tipoDestinatario,
  rolDestino,
  idUsuarioDestino,
} = {}) {
  const tipo = normalizarTipoDestinatario(tipoDestinatario);
  const idUsuario = toPositiveNumber(idUsuarioDestino);

  let where = `u.estado = 'ACTIVO' AND u.es_verificado = 'SI'`;
  const binds = {};

  if (tipo === TIPOS_DESTINATARIO.ESPECIFICO) {
    if (!idUsuario) return [];
    where += ` AND u.id_usuario = :idUsuario`;
    binds.idUsuario = idUsuario;
  } else {
    const roles = rolesParaRol(rolDestino) || ROLES_POR_TIPO[tipo] || null;
    if (roles && roles.length > 0) {
      const marcadores = roles.map((rol, indice) => {
        const bind = `rol${indice}`;
        binds[bind] = rol;
        return `:${bind}`;
      });
      where += ` AND UPPER(r.nombre) IN (${marcadores.join(", ")})`;
    }
  }

  const sql = `
    SELECT
      u.id_usuario,
      u.nombre_usuario,
      p.nombres || ' ' || p.apellidos AS nombre_completo,
      p.correo,
      p.telefono,
      r.nombre AS rol
    FROM USUARIO u
    JOIN PERSONA p ON u.id_persona = p.id_persona
    JOIN ROL r ON u.id_rol = r.id_rol
    WHERE ${where}
    ORDER BY p.nombres ASC, p.apellidos ASC`;

  const result = await executeQuery(sql, binds);

  return (result.rows || []).map((row) => ({
    idUsuario: row.ID_USUARIO,
    nombreUsuario: row.NOMBRE_USUARIO,
    nombreCompleto: row.NOMBRE_COMPLETO,
    correo: row.CORREO,
    telefono: row.TELEFONO,
    rol: row.ROL,
  }));
}

function construirMensaje({ origen, titulo, contenido }) {
  const encabezado = String(origen || "").toUpperCase() === "QUEJA"
    ? "Nueva queja/sugerencia"
    : "Aviso del condominio";

  return `*${encabezado}*\n\n*${titulo}*\n${contenido}`;
}

/**
 * Despacha correo y/o WhatsApp a los destinatarios resueltos. Los errores de
 * los proveedores se registran pero NUNCA interrumpen el guardado principal.
 */
async function enviarNotificaciones({
  destinatarios,
  titulo,
  contenido,
  canalEnvio = "APP",
  enviarWhatsApp = false,
  origen = "COMUNICADO",
} = {}) {
  const canal = String(canalEnvio || "APP").trim().toUpperCase();
  const debeEnviarEmail = ["EMAIL", "AMBOS", "TODOS"].includes(canal);
  const debeEnviarWhatsApp =
    parseBoolean(enviarWhatsApp) || ["WHATSAPP", "AMBOS", "TODOS"].includes(canal);

  const resumen = {
    totalDestinatarios: Array.isArray(destinatarios) ? destinatarios.length : 0,
    correosEnviados: 0,
    whatsappEnviados: 0,
    errores: [],
  };

  if (!Array.isArray(destinatarios) || destinatarios.length === 0) return resumen;
  if (!debeEnviarEmail && !debeEnviarWhatsApp) return resumen;

  const mensaje = construirMensaje({ origen, titulo, contenido });
  const tareas = [];

  for (const usuario of destinatarios) {
    if (debeEnviarEmail && usuario.correo) {
      tareas.push(
        sendEmail({
          to: usuario.correo,
          subject: `[Condominio] ${titulo}`,
          text: contenido,
          html: `<h3>${titulo}</h3><p>${contenido}</p>`,
        })
          .then(() => {
            resumen.correosEnviados += 1;
          })
          .catch((error) => {
            resumen.errores.push(`Email ${usuario.correo}: ${error.message}`);
            console.error(`Error enviando email a ${usuario.correo}:`, error.message);
          })
      );
    }

    if (debeEnviarWhatsApp && usuario.telefono) {
      tareas.push(
        sendWhatsApp({ to: usuario.telefono, message: mensaje })
          .then((resultado) => {
            if (resultado?.success && !resultado?.skipped) {
              resumen.whatsappEnviados += 1;
            }
          })
          .catch((error) => {
            resumen.errores.push(`WhatsApp ${usuario.telefono}: ${error.message}`);
            console.error(`Error enviando WhatsApp a ${usuario.telefono}:`, error.message);
          })
      );
    }
  }

  await Promise.allSettled(tareas);
  return resumen;
}

module.exports = {
  TIPOS_DESTINATARIO,
  normalizarRol,
  normalizarTipoDestinatario,
  parseBoolean,
  toPositiveNumber,
  resolverRolDestino,
  listarUsuariosDestino,
  obtenerDestinatarios,
  enviarNotificaciones,
};
