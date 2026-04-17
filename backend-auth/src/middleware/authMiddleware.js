const jwt = require("jsonwebtoken");
const env = require("../config/env");
const userService = require("../services/userService");

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

async function authenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      const error = new Error("Authorization token is required.");
      error.statusCode = 401;
      throw error;
    }

    const payload = jwt.verify(token, env.jwt.secret);
    const user = await userService.findByIdWithRoles(payload.sub);

    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 401;
      throw error;
    }

    req.user = {
      id: user.id,
      email: user.email,
      account_status: user.account_status,
      roles: Array.isArray(user.roles) ? user.roles : []
    };

    if (["suspended", "deleted"].includes(String(user.account_status || "").toLowerCase())) {
      const error = new Error("Account is not allowed to access this resource.");
      error.statusCode = 403;
      throw error;
    }

    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      err.statusCode = 401;
      err.message = "Token has expired.";
    } else if (err.name === "JsonWebTokenError") {
      err.statusCode = 401;
      err.message = "Invalid token.";
    }

    return next(err);
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      const error = new Error("Unauthorized.");
      error.statusCode = 401;
      return next(error);
    }

    const roles = Array.isArray(req.user.roles) ? req.user.roles : [];
    const hasRole = roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      const error = new Error("Forbidden: insufficient permissions.");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}

const requireAdmin = authorizeRoles("admin");

module.exports = {
  authenticate,
  authorizeRoles,
  requireAdmin
};
