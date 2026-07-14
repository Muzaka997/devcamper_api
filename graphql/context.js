// Builds the GraphQL context. Reuses the same JWT logic as
// middleware/auth.js so resolvers can read `context.user` just like REST
// handlers read `req.user`. Auth is optional here: courses are public, so we
// attach the user when a valid token is present and leave it null otherwise.
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const extractToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const parts = String(authHeader).trim().split(" ");
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
    if (parts.length === 1) return parts[0];
  }
  if (req.headers["x-auth-token"]) return req.headers["x-auth-token"];
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
};

const buildContext = async ({ req }) => {
  const token = extractToken(req);
  let user = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id);
    } catch (_) {
      // Invalid/expired token → treat as anonymous; public fields still resolve
      user = null;
    }
  }

  return { user };
};

module.exports = buildContext;
