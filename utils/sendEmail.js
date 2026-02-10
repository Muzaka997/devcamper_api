const nodemailer = require("nodemailer");

// options: { email, subject, message, html?, replyTo? }
const sendEmail = async (options) => {
  // Support either a known service (e.g., gmail) or custom host/port
  const useService = process.env.SMTP_SERVICE; // e.g. 'gmail'

  const transporter = useService
    ? nodemailer.createTransport({
        service: useService,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    : nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for others
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      });

  // Send an email using async/await

  const message = {
    // Allow callers to override the from address (useful to send "from" the logged-in user)
    // Note: many SMTP providers only allow verified sender addresses. If the override fails,
    // the provider may replace it or reject the message.
    from:
      options.from || `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
    replyTo: options.replyTo,
  };

  const info = await transporter.sendMail(message);

  console.log("Message sent:", info.messageId);
};

module.exports = sendEmail;
