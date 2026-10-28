const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

/**
 * Servicio de despacho de WhatsApp mediante Twilio o Simulación
 */
exports.sendWhatsApp = async ({ to, message }) => {
  try {
    if (!to || !message) {
      throw new Error('El número de destino y el mensaje son obligatorios.');
    }

    let cleanNumber = to.trim().replace(/[^\d+]/g, '');
    if (!cleanNumber.startsWith('+')) {
      const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || '+502';
      cleanNumber = `${defaultCountryCode}${cleanNumber}`;
    }

    const formattedTo = cleanNumber.startsWith('whatsapp:') ? cleanNumber : `whatsapp:${cleanNumber}`;

    if (!client) {
      console.log('--- [SIMULACIÓN WHATSAPP] ---');
      console.log(`Para: ${formattedTo}`);
      console.log(`Mensaje:\n${message}`);
      console.log('------------------------------');
      return { success: true, simulated: true };
    }

    const response = await client.messages.create({
      body: message,
      from: fromWhatsAppNumber,
      to: formattedTo
    });

    return { success: true, messageId: response.sid };
  } catch (error) {
    console.error(`Error en sendWhatsApp a (${to}):`, error.message);
    return { success: false, error: error.message };
  }
};