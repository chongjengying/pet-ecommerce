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
    { sub: user.id, email: user.email, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

async function register({ email, password, name }) {
  const existingUser = await userService.findByEmail(email);
  if (existingUser) {
    throw new AuthError("Email is already registered.", 409);
  }

  const hashedPassword = await bcrypt.hash(password, env.auth.bcryptRounds);
  let createdUser;
  try {
    createdUser = await userService.createUser({
      email,
      hashedPassword,
      name,
      role: "customer"
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
  const user = await userService.findByEmail(email);
  if (!user) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const token = signAccessToken(user);
  const userWithoutPassword = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at
  };

  return {
    token,
    user: userWithoutPassword
  };
}

module.exports = {
  AuthError,
  register,
  login
};
