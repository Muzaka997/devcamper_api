const nodemailer = require("nodemailer");

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

// options: { email, subject, message, html?, replyTo?, from? }
const sendEmail = async (options) => {
  // SMTP-only implementation (no RESEND path)
  const svc = (process.env.SMTP_SERVICE || "").trim().toLowerCase();
  const smtpUser = process.env.SMTP_EMAIL;
  // Remove spaces commonly shown in app passwords (e.g., Gmail shows 4x4 with spaces)
  const smtpPass = (process.env.SMTP_PASSWORD || "").replace(/\s+/g, "");

  if (!smtpUser || !smtpPass) {
    throw new Error(
      "SMTP credentials are not configured (SMTP_EMAIL/SMTP_PASSWORD)",
    );
  }

  const baseFrom =
    options.from || `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`;
  if (!baseFrom) {
    throw new Error("FROM_EMAIL (and optionally FROM_NAME) must be configured");
  }

  // Build a transporter with reasonable timeouts
  const buildTransport = (t) =>
    nodemailer.createTransport({
      ...t,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000, // 10s
      greetingTimeout: 10000,
      socketTimeout: 20000,
      tls: {
        // Some providers care about SNI
        servername: t.host || undefined,
      },
    });

  // Preferred transports to try (in order)
  const transports = [];

  if (svc) {
    // Service shortcut (e.g., gmail)
    transports.push({ service: svc });
  }

  // Explicit host/port if provided
  const host =
    process.env.SMTP_HOST || (svc === "gmail" ? "smtp.gmail.com" : undefined);
  const envPort = Number(process.env.SMTP_PORT) || undefined;
  if (host) {
    if (envPort) {
      transports.push({ host, port: envPort, secure: envPort === 465 });
    } else {
      // Try SMTPS 465 then STARTTLS 587
      transports.push({ host, port: 465, secure: true });
      transports.push({ host, port: 587, secure: false });
    }
  }

  if (transports.length === 0) {
    // Fallback sensible defaults (STARTTLS 587)
    transports.push({ host: "smtp.gmail.com", port: 587, secure: false });
  }

  const message = {
    from: baseFrom,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html:
      options.html ||
      `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(
        options.message || "",
      )}</div>`,
    replyTo: options.replyTo,
  };

  let lastErr;
  for (const t of transports) {
    try {
      const transporter = buildTransport(t);
      const info = await transporter.sendMail(message);
      console.log(
        "Email sent via",
        t.service || `${t.host}:${t.port}`,
        info.messageId,
      );
      return;
    } catch (err) {
      lastErr = err;
      const code = (err && (err.code || err.name)) || "UNKNOWN";
      console.warn(
        "Email send attempt failed (",
        code,
        ") via",
        t.service || `${t.host}:${t.port}`,
        "-",
        err.message,
      );
      // Retry with next transport
      continue;
    }
  }

  // Exhausted attempts
  throw lastErr || new Error("Email sending failed: unknown error");
};

module.exports = sendEmail;
