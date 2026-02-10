const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const sendEmail = require("../utils/sendEmail");

// @desc      Send contact message
// @route     POST /api/v1/contact
// @access    Private (must be logged in so email matches account)
exports.sendContactMessage = asyncHandler(async (req, res, next) => {
  const { name, email, message } = req.body || {};

  if (!message) {
    return next(new ErrorResponse("Message is required", 400));
  }

  // Enforce that the sender email matches the authenticated user's account email
  const accountEmail = req.user?.email;
  const accountName = req.user?.name;

  if (!accountEmail) {
    return next(new ErrorResponse("Not authorized to send message", 401));
  }

  // If client passed an email, make sure it matches the account email
  if (email && email.toLowerCase() !== String(accountEmail).toLowerCase()) {
    return next(new ErrorResponse("Email must match your account email", 400));
  }

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

  const displayName = name || accountName || "User";
  const subject = `New contact message from ${displayName}`;
  const composed = `From: ${displayName} <${accountEmail}>\n\nMessage:\n${message}`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#333">
      <p><strong>From:</strong> ${displayName} &lt;${accountEmail}&gt;</p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-line">${message}</p>
    </div>
  `;

  try {
    await sendEmail({
      email: to,
      subject,
      message: composed,
      html,
      // Try to send directly "from" the user's email so the recipient sees the same address as the account
      // Many SMTP providers require verified senders; this may fail. If so, we retry with default FROM_*.
      from: `${displayName} <${accountEmail}>`,
      replyTo: accountEmail,
    });
  } catch (e) {
    // Fallback: send from the server default, but keep reply-to as the user's email
    await sendEmail({
      email: to,
      subject,
      message: composed,
      html,
      replyTo: accountEmail,
    });
  }

  return res.status(200).json({ success: true, data: { sent: true } });
});
