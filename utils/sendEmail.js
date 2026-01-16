const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // Create a transporter using Ethereal test credentials.
  // For production, replace with your actual SMTP server details.
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // Send an email using async/await

  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  const info = await transporter.sendMail(message);

  console.log("Message sent:", info.messageId);
};

module.exports = sendEmail;
