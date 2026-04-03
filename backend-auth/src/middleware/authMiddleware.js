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
    const user = await userService.findById(payload.sub);

    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 401;
      throw error;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };

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

function authorizeRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      const error = new Error("Unauthorized.");
      error.statusCode = 401;
      return next(error);
    }

    if (!roles.includes(req.user.role)) {
      const error = new Error("Forbidden: insufficient permissions.");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorizeRoles
};
