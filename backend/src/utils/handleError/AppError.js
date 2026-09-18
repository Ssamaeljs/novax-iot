class AppError extends Error {
  constructor(message, status = 400, code = "APPLICATION_ERROR", details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

module.exports = AppError;
