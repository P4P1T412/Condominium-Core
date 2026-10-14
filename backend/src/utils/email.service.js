/**
 * =============================================================================
 * SERVICIO DE CORREO ELECTRÓNICO (Nodemailer con Gmail)
 * =============================================================================
 */

const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM =
  process.env.EMAIL_FROM || `"Sistema Condominio" <${EMAIL_USER}>`;

// URL base del frontend para construir los enlaces de recuperación.
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Vigencia del enlace de recuperación (solo informativa para la plantilla).
const HORAS_VIGENCIA_TOKEN = 1;

// Validación básica de entorno
const CONFIGURACION_INVALIDA = !EMAIL_USER || !EMAIL_PASS;

/**
 * Transporter SMTP utilizando el servicio integrado de Gmail.
 * El atajo "service: 'gmail'" configura automáticamente el host,
 * el puerto y la seguridad TLS/SSL correcta para Google.
 */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/**
 * Construye la plantilla HTML del correo de verificación.
 *
 * @param {string} name Nombre del destinatario.
 * @param {string} code Código numérico de 6 dígitos.
 * @returns {string} Documento HTML listo para enviar.
 */
function buildVerificationTemplate(name, code) {
  const nombreSeguro = String(name || "Usuario").replace(/[<>&]/g, "");

  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Verificación de cuenta</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F7F9FC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F9FC;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
              <!-- Encabezado -->
              <tr>
                <td style="background-color:#1B4B82;padding:28px 32px;text-align:center;">
                  <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">Sistema de Gestión de Condominio</h1>
                </td>
              </tr>
              <!-- Cuerpo -->
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 12px 0;color:#101828;font-size:18px;font-weight:700;">Hola ${nombreSeguro},</h2>
                  <p style="margin:0 0 20px 0;color:#475467;font-size:14px;line-height:1.6;">
                    Gracias por registrarte. Para verificar tu correo electrónico, ingresa el
                    siguiente código de 6 dígitos en la pantalla de verificación:
                  </p>
                  <div style="text-align:center;margin:0 0 24px 0;">
                    <span style="display:inline-block;background-color:#EEF4FB;color:#1B4B82;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 24px;border-radius:10px;border:1px dashed #B7CDE8;">
                      ${code}
                    </span>
                  </div>
                  <p style="margin:0 0 8px 0;color:#475467;font-size:13px;line-height:1.6;">
                    Este código caduca en <strong>24 horas</strong>.
                  </p>
                  <p style="margin:0;color:#98A2B3;font-size:12px;line-height:1.6;">
                    Si no solicitaste este registro, puedes ignorar este mensaje.
                  </p>
                </td>
              </tr>
              <!-- Pie -->
              <tr>
                <td style="background-color:#F7F9FC;border-top:1px solid #E5E7EB;padding:18px 32px;text-align:center;">
                  <p style="margin:0;color:#98A2B3;font-size:11px;">
                    Este es un correo automático, por favor no responda a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

/**
 * Envía el correo de verificación con el código de 6 dígitos.
 *
 * @param {string} email Correo destino del solicitante.
 * @param {string} name Nombre del solicitante para personalizar el mensaje.
 * @param {string} code Código numérico de 6 dígitos.
 * @returns {Promise<object>} Resultado del envío (info de Nodemailer).
 * @throws {Error} Si la configuración SMTP no está lista o falla el envío.
 */
async function sendVerificationEmail(email, name, code) {
  if (CONFIGURACION_INVALIDA) {
    const error = new Error(
      "Configuración de correo de Gmail no establecida. Defina EMAIL_USER y EMAIL_PASS en el archivo .env."
    );
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: `Tu código de verificación es ${code}`,
    html: buildVerificationTemplate(name, code),
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Construye la plantilla HTML del correo de recuperación de contraseña.
 *
 * @param {string} name Nombre del destinatario.
 * @param {string} token Token de recuperación generado por el backend.
 * @returns {string} Documento HTML listo para enviar.
 */
function buildPasswordResetTemplate(name, token) {
  const nombreSeguro = String(name || "Usuario").replace(/[<>&]/g, "");
  const resetUrl = `${FRONTEND_URL}/restablecer-contrasena?token=${encodeURIComponent(token)}`;

  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Recuperación de contraseña</title>
    </head>
    <body style="margin:0;padding:0;background-color:#F7F9FC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#F7F9FC;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background-color:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
              <!-- Encabezado -->
              <tr>
                <td style="background-color:#1B4B82;padding:28px 32px;text-align:center;">
                  <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">Sistema de Gestión de Condominio</h1>
                </td>
              </tr>
              <!-- Cuerpo -->
              <tr>
                <td style="padding:32px;">
                  <h2 style="margin:0 0 12px 0;color:#101828;font-size:18px;font-weight:700;">Hola ${nombreSeguro},</h2>
                  <p style="margin:0 0 20px 0;color:#475467;font-size:14px;line-height:1.6;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta.
                    Haz clic en el siguiente botón para crear una nueva contraseña:
                  </p>
                  <div style="text-align:center;margin:0 0 24px 0;">
                    <a href="${resetUrl}" style="display:inline-block;background-color:#1B4B82;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">
                      Restablecer mi contraseña
                    </a>
                  </div>
                  <p style="margin:0 0 8px 0;color:#475467;font-size:13px;line-height:1.6;">
                    Este enlace caduca en <strong>${HORAS_VIGENCIA_TOKEN} hora</strong>.
                  </p>
                  <p style="margin:0 0 16px 0;color:#98A2B3;font-size:12px;line-height:1.6;">
                    Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
                  </p>
                  <p style="margin:0 0 16px 0;word-break:break-all;">
                    <a href="${resetUrl}" style="color:#1B4B82;font-size:12px;line-height:1.6;">${resetUrl}</a>
                  </p>
                  <p style="margin:0;color:#98A2B3;font-size:12px;line-height:1.6;">
                    Si no solicitaste este cambio, puedes ignorar este mensaje; tu contraseña actual permanecerá sin cambios.
                  </p>
                </td>
              </tr>
              <!-- Pie -->
              <tr>
                <td style="background-color:#F7F9FC;border-top:1px solid #E5E7EB;padding:18px 32px;text-align:center;">
                  <p style="margin:0;color:#98A2B3;font-size:11px;">
                    Este es un correo automático, por favor no responda a este mensaje.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

/**
 * Envía el correo de recuperación de contraseña con el enlace de restablecimiento.
 *
 * @param {string} email Correo destino del solicitante.
 * @param {string} name Nombre del solicitante para personalizar el mensaje.
 * @param {string} token Token de recuperación generado por el backend.
 * @returns {Promise<object>} Resultado del envío (info de Nodemailer).
 * @throws {Error} Si la configuración SMTP no está lista o falla el envío.
 */
async function sendPasswordResetEmail(email, name, token) {
  if (CONFIGURACION_INVALIDA) {
    const error = new Error(
      "Configuración de correo de Gmail no establecida. Defina EMAIL_USER y EMAIL_PASS en el archivo .env."
    );
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Recuperación de contraseña - Sistema de Condominio",
    html: buildPasswordResetTemplate(name, token),
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  sendVerificationEmail,
  sendPasswordResetEmail,
};