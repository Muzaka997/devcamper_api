const jwt = require("jsonwebtoken");
const asyncHandler = require("./async");
const ErrorResponse = require("../utils/errorResponse");
const User = require("../models/User");

// Protect routes
exports.protect = asyncHandler(async (req, res, next) => {
  let token;

  // Prefer Authorization header (case-insensitive), accept variations and fallbacks
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const parts = String(authHeader).trim().split(" ");
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1];
    } else if (parts.length === 1) {
      // Allow raw token without scheme
      token = parts[0];
    }
  }

  // Fallbacks: custom header and cookie
  if (!token && req.headers["x-auth-token"]) {
    token = req.headers["x-auth-token"];
  }
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse("Not authorized: token missing", 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return next(new ErrorResponse("Not authorized: user not found", 401));
    }

    next();
  } catch (err) {
    return next(new ErrorResponse("Not authorized: token invalid", 401));
  }
});

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role ${req.user.role} is not authorized to access this route`,
          403,
        ),
      );
    }
    next();
  };
};
