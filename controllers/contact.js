const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/sendEmail");

// @desc      Send contact message
// @route     POST /api/v1/contact
// @access    Public (no auth required)
exports.sendContactMessage = asyncHandler(async (req, res, next) => {
  const { name, email, message } = req.body || {};

  if (!message || typeof message !== "string" || message.trim().length < 3) {
    return next(new ErrorResponse("A valid message is required", 400));
  }

  // Prefer authenticated user email if present; otherwise require a valid email in body
  const accountEmail = req.user?.email;
  const accountName = req.user?.name;

  // Basic email validation
  const isEmail = (val) =>
    typeof val === "string" && /.+@.+\..+/.test(val.trim());

  const senderEmail = accountEmail || (isEmail(email) ? email.trim() : null);
  if (!senderEmail) {
    return next(new ErrorResponse("A valid email is required", 400));
  }

  const displayName = (name || accountName || "Anonymous").toString().trim();

  // Recipient (site owner)
  const to = process.env.CONTACT_RECIPIENT_EMAIL || process.env.FROM_EMAIL;
  if (!to) {
    return next(
      new ErrorResponse(
        "Email recipient not configured on server (CONTACT_RECIPIENT_EMAIL)",
        500,
      ),
    );
  }

  const subject = `New contact message from ${displayName}`;
  const composed = `From: ${displayName} <${senderEmail}>\n\nMessage:\n${message}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333">
      <p><strong>From:</strong> ${displayName} &lt;${senderEmail}&gt;</p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-line">${message}</p>
    </div>
  `;

  // Use a verified sender for best deliverability; set reply-to to the real sender
  await sendEmail({
    email: to,
    subject,
    message: composed,
    html,
    replyTo: senderEmail,
  });

  return res.status(200).json({ success: true, data: { sent: true } });
});
