const crypto = require("crypto");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");

// @desc      Register user (sends email verification link)
// @route     POST /api/v1/auth/register
// @access    Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = await User.create({ name, email, password, role });

  // Generate email verification token
  const verifyToken = user.getEmailVerifyToken();
  await user.save({ validateBeforeSave: false });

  const frontendBase =
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://example.com" // fallback, update FRONTEND_URL in env
      : "http://localhost:5173");

  const verifyUrl = `${frontendBase}/verify-email?token=${verifyToken}`;

  const message = `Please verify your email by clicking the following link: ${verifyUrl}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2>Verify your email</h2>
      <p>Hi ${name || "there"},</p>
      <p>Thanks for registering. Please confirm this email address to activate your account.</p>
      <p>
        <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#1976d2;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL in your browser:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link will expire in 24 hours.</p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Verify your email",
      message,
      html,
    });
  } catch (err) {
    // cleanup tokens if email fails
    user.emailVerifyToken = undefined;
    user.emailVerifyExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse("Verification email could not be sent", 500));
  }

  res.status(200).json({
    success: true,
    message:
      "Registration successful. Please check your email to verify your account.",
  });
});

// @desc      Login user
// @route     POST /api/v1/auth/login
// @access    Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ErrorResponse("Please provide an email and password", 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  if (!user.isEmailVerified) {
    return next(
      new ErrorResponse(
        "Please verify your email before logging in. We've sent you a verification link.",
        401,
      ),
    );
  }

  sendTokenResponse(user, 200, res);
});

// @desc      Log user out / clear cookie
// @route     GET /api/v1/auth/logout
// @access    Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc      Get current logged in user
// @route     POST /api/v1/auth/me
// @access    Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({ success: true, data: user });
});

// @desc      Update current logged in user
// @route     PUT /api/v1/auth/updatedetails
// @access    Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, data: user });
});

// @desc      Update password
// @route     PUT /api/v1/auth/updatepassword
// @access    Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse("Password is incorrect", 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc      Verify email
// @route     GET /api/v1/auth/verifyemail/:verifytoken
// @access    Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const hashed = crypto
    .createHash("sha256")
    .update(req.params.verifytoken)
    .digest("hex");

  const user = await User.findOne({
    emailVerifyToken: hashed,
    emailVerifyExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorResponse("Invalid or expired verification token", 400),
    );
  }

  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpire = undefined;
  await user.save({ validateBeforeSave: false });

  // After verification, issue auth token so user is signed in
  sendTokenResponse(user, 200, res);
});

// @desc      Forgot password
// @route     POST /api/v1/auth/forgotpassword
// @access    Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ErrorResponse("There is no user with that email", 404));
  }

  // Get reset token
  const resetToken = user.getResetPasswordToken();

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const resetUrl = `${req.protocol}://${req.get(
    "host",
  )}/api/v1/auth/resetpassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Password reset token",
      message,
    });
    res.status(200).json({ success: true, data: "Email sent" });
  } catch (err) {
    console.log(err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse("Email could not be sent", 500));
  }

  res.status(200).json({ success: true, data: user });
});

// @desc      Reset password
// @route     PUT /api/v1/auth/resetpassword/:resettoken
// @access    Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.resettoken)
    .digest("hex");
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ErrorResponse("Invalid token", 400));
  }
  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };

  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    options.secure = true; // cookie only over HTTPS
    options.sameSite = "none"; // allow cross-site cookie for API on different domain
  } else {
    // In local dev, allow default lax which works for same-site localhost origins
    options.sameSite = "lax";
  }

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({ success: true, token });
};
