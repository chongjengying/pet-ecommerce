const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const userService = require("./userService");

class AuthError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, roles: user.roles },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

function canLogin(accountStatus) {
  const status = String(accountStatus || "").toLowerCase();
  if (status === "suspended" || status === "deleted") return false;
  return true;
}

async function register({ email, password }) {
  const existingUser = await userService.findByEmailForAuth(email);
  if (existingUser) {
    throw new AuthError("Email is already registered.", 409);
  }

  const passwordHash = await bcrypt.hash(password, env.auth.bcryptRounds);
  let createdUser;
  try {
    createdUser = await userService.createUser({
      email,
      passwordHash,
      accountStatus: "active",
      roles: ["customer"]
    });
  } catch (err) {
    if (err && err.code === "23505") {
      throw new AuthError("Email is already registered.", 409);
    }
    throw err;
  }

  const token = signAccessToken(createdUser);
  return {
    token,
    user: createdUser
  };
}

async function login({ email, password }) {
  const user = await userService.findByEmailForAuth(email);
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AuthError("Invalid email or password.", 401);
  }

  if (!canLogin(user.account_status)) {
    throw new AuthError("Your account is not allowed to log in.", 403);
  }

  await userService.updateLastLoginAt(user.id);

  const token = signAccessToken(user);
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      account_status: user.account_status,
      created_at: user.created_at,
      roles: user.roles,
      flagged: user.account_status === "inactive"
    }
  };
}

async function resetPassword({ email, currentPassword, newPassword }) {
  const user = await userService.findByEmailForAuth(email);
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    throw new AuthError("Current password is incorrect.", 401);
  }

  const nextHash = await bcrypt.hash(newPassword, env.auth.bcryptRounds);
  const updated = await userService.updatePasswordByEmail(email, nextHash);
  if (!updated) {
    throw new AuthError("User not found.", 404);
  }

  return {
    success: true,
    message: "Password reset successful.",
  };
}

module.exports = {
  AuthError,
  register,
  login,
  resetPassword
};
