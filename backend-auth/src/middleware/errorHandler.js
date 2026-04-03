function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: statusCode === 500 ? "Internal server error." : err.message
  };

  if (process.env.NODE_ENV !== "production" && statusCode === 500) {
    response.error = err.message;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
