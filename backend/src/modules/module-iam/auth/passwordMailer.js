const nodemailer = require("nodemailer");

function isConfigured() {
  try {
    const origin = new URL(process.env.WEB_ORIGIN);
    return Boolean(
      process.env.SMTP_HOST &&
        process.env.SMTP_FROM &&
        (origin.protocol === "https:" ||
          (process.env.NODE_ENV !== "production" &&
            ["localhost", "127.0.0.1"].includes(origin.hostname))),
    );
  } catch {
    return false;
  }
}
async function sendReset(email, token) {
  const url = new URL("/auth/reset-password", process.env.WEB_ORIGIN);
  url.hash = new URLSearchParams({ token }).toString();
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS:
      process.env.NODE_ENV === "production" &&
      process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Novax IoT · Recupera tu acceso",
    text: `Recibimos una solicitud para restablecer tu contraseña. El enlace es válido durante 30 minutos y solo se puede usar una vez.\n\n${url}\n\nSi no lo solicitaste, ignora este mensaje.`,
  });
}
module.exports = { isConfigured, sendReset };
