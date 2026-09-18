const { ValidationError, UniqueConstraintError } = require("sequelize");

function handleError(error, res) {
  console.error(error);

  if (error.isOperational) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      error: "Registro duplicado",
      code: "DUPLICATE_RESOURCE",
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: "Error de validación",
      code: "VALIDATION_ERROR",
      details: error.errors.map((e) => e.message),
    });
  }

  return res.status(500).json({
    error: "Internal Server Error",
    code: "INTERNAL_ERROR",
  });
}

module.exports = handleError;
