const twilio = require("twilio");

let clienteCache = null;

function obtenerConfiguracion() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const contentSid = process.env.TWILIO_CONTENT_SID;
  const fromConfigurado =
    process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
  const from = String(fromConfigurado).startsWith("whatsapp:")
    ? String(fromConfigurado)
    : `whatsapp:${String(fromConfigurado).trim()}`;

  return { accountSid, authToken, contentSid, from };
}

function normalizarWhatsApp(numero, defaultCountryCode) {
  let limpio = String(numero || "").trim().replace(/[^\d+]/g, "");

  if (!limpio) {
    throw new Error("El número de destino de WhatsApp está vacío.");
  }

  if (!limpio.startsWith("+")) {
    const prefijo = String(defaultCountryCode || "+502").replace(/[^\d+]/g, "");
    limpio = `${prefijo}${limpio.replace(/^0+/, "")}`;
  }

  return limpio;
}

function obtenerCliente() {
  const { accountSid, authToken } = obtenerConfiguracion();

  if (!accountSid || !authToken) {
    return null;
  }

  if (!clienteCache) {
    clienteCache = twilio(accountSid, authToken);
  }

  return clienteCache;
}

exports.isConfigured = () => {
  const { accountSid, authToken, contentSid } = obtenerConfiguracion();
  return Boolean(accountSid && authToken && contentSid);
};

/**
 * Envía un mensaje por la API de WhatsApp de Twilio usando una plantilla
 * aprobada de Content API (ContentSid).
 *
 * Si faltan las credenciales o el TWILIO_CONTENT_SID, el envío se omite con un
 * console.log suave y se devuelve un resultado descriptivo. Los errores del
 * proveedor (por ejemplo, un número no registrado en WhatsApp) también se
 * registran sin lanzar excepciones hacia el flujo principal de avisos/quejas.
 */
exports.sendWhatsApp = async ({ to, message } = {}) => {
  let destino = "";

  try {
    if (!to || !message) {
      throw new Error("El número de destino y el mensaje son obligatorios.");
    }

    const mensajeTexto = String(message);
    const { accountSid, authToken, contentSid, from } = obtenerConfiguracion();
    destino = normalizarWhatsApp(to, process.env.DEFAULT_COUNTRY_CODE);

    const faltantes = [];
    if (!accountSid) faltantes.push("TWILIO_ACCOUNT_SID");
    if (!authToken) faltantes.push("TWILIO_AUTH_TOKEN");
    if (!contentSid) faltantes.push("TWILIO_CONTENT_SID");

    const client = obtenerCliente();
    if (!client || faltantes.length > 0) {
      console.log(
        `[WhatsApp] Twilio no está configurado (faltan ${faltantes.join(", ")}). ` +
        `Se omite el envío a whatsapp:${destino}.`
      );
      return {
        success: false,
        skipped: true,
        reason: "TWILIO_NOT_CONFIGURED",
        missing: faltantes,
      };
    }

    const response = await client.messages.create({
      from,
      to: `whatsapp:${destino}`,
      contentSid,
      contentVariables: JSON.stringify({ "1": mensajeTexto }),
    });

    return { success: true, messageId: response.sid };
  } catch (error) {
    console.log(
      `[WhatsApp] No se pudo enviar el mensaje a ${destino ? `whatsapp:${destino}` : to}: ${error.message}`
    );
    return { success: false, error: error.message };
  }
};
