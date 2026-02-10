const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/sendEmail");

// @desc      Send contact message
// @route     POST /api/v1/contact
// @access    Private (auth required)
exports.sendContactMessage = asyncHandler(async (req, res, next) => {
  const { name, message } = req.body || {};

  if (!message || typeof message !== "string" || message.trim().length < 3) {
    return next(new ErrorResponse("A valid message is required", 400));
  }

  // Use only the authenticated account's email; ignore any email from body
  if (!req.user || !req.user.email) {
    return next(new ErrorResponse("Not authorized", 401));
  }
  const senderEmail = req.user.email;
  const displayName = (name || req.user.name || "User").toString().trim();

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

  // Try to send email; do not fail the request in production environments
  try {
    await sendEmail({
      email: to,
      subject,
      message: composed,
      html,
      replyTo: senderEmail,
    });
    return res.status(200).json({ success: true, data: { sent: true } });
  } catch (err) {
    // Log but respond success so UI can proceed (useful on hosts that block SMTP)
    console.warn("Contact email send failed:", err?.message || err);
    return res
      .status(200)
      .json({ success: true, data: { sent: false, note: "email_not_sent" } });
  }
});
