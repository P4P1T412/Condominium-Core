/**
 * =============================================================================
 * SERVICIO DE CORREO ELECTRÓNICO (SMTP configurable + Simulación)
 * =============================================================================
 */

const nodemailer = require("nodemailer");

const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER;
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || (EMAIL_USER ? `"Sistema Condominio" <${EMAIL_USER}>` : undefined);
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;

// URL base del frontend para construir los enlaces de recuperación.
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CLIENT_URL;

// Vigencia del enlace de recuperación (solo informativa para la plantilla).
const HORAS_VIGENCIA_TOKEN = 1;

const transporterOptions = SMTP_HOST
  ? { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE }
  : EMAIL_SERVICE
  ? { service: EMAIL_SERVICE }
  : null;
const CONFIGURACION_INVALIDA = !EMAIL_USER || !EMAIL_PASS || !transporterOptions;
const transporter = CONFIGURACION_INVALIDA
  ? null
  : nodemailer.createTransport({ ...transporterOptions, auth: { user: EMAIL_USER, pass: EMAIL_PASS } });

/**
 * Plantilla HTML del correo de verificación.
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
              <tr>
                <td style="background-color:#1B4B82;padding:28px 32px;text-align:center;">
                  <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">Sistema de Gestión de Condominio</h1>
                </td>
              </tr>
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
 */
async function sendVerificationEmail(email, name, code) {
  if (CONFIGURACION_INVALIDA) {
    console.log("--- [SIMULACIÓN VERIFICACIÓN EMAIL] ---");
    console.log(`Para: ${email}`);
    console.log(`Código: ${code}`);
    return { success: true, simulated: true };
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
 * Plantilla HTML del correo de recuperación de contraseña.
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
              <tr>
                <td style="background-color:#1B4B82;padding:28px 32px;text-align:center;">
                  <h1 style="margin:0;color:#FFFFFF;font-size:20px;font-weight:700;">Sistema de Gestión de Condominio</h1>
                </td>
              </tr>
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
 * Envía el correo de recuperación de contraseña.
 */
async function sendPasswordResetEmail(email, name, token) {
  if (CONFIGURACION_INVALIDA) {
    console.log("--- [SIMULACIÓN RECUPERACIÓN EMAIL] ---");
    console.log(`Para: ${email}`);
    console.log(`Token: ${token}`);
    return { success: true, simulated: true };
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: "Recuperación de contraseña - Sistema de Condominio",
    html: buildPasswordResetTemplate(name, token),
  };

  return transporter.sendMail(mailOptions);
}

/**
 * Función genérica de envío utilizada por los módulos de Visitas y Notificaciones.
 */
async function sendEmail({ to, subject, text, html, attachments }) {
  if (CONFIGURACION_INVALIDA) {
    console.log("--- [SIMULACIÓN ENVÍO EMAIL] ---");
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log("---------------------------------");
    return { success: true, simulated: true };
  }

  const mailOptions = {
    from: EMAIL_FROM,
    to,
    subject,
    text,
    html,
    attachments
  };

  return transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};