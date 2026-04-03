function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validateRegisterInput(req, _res, next) {
  const { email, password, name } = req.body || {};

  if (!isValidEmail(email)) {
    return next(validationError("Please provide a valid email address."));
  }
  if (typeof password !== "string" || password.length < 8) {
    return next(validationError("Password must be at least 8 characters."));
  }
  if (typeof name !== "string" || name.trim().length < 2) {
    return next(validationError("Name must be at least 2 characters."));
  }

  return next();
}

function validateLoginInput(req, _res, next) {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    return next(validationError("Please provide a valid email address."));
  }
  if (typeof password !== "string" || password.length === 0) {
    return next(validationError("Password is required."));
  }

  return next();
}

module.exports = {
  validateRegisterInput,
  validateLoginInput
};
