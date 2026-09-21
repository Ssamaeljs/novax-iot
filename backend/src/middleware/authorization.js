const AppError = require("../utils/handleError/AppError");
const handleError = require("../utils/handleError/handleError");

function requirePermission(permission) {
  return (req, res, next) => {
    try {
      if (!req.auth) {
        throw new AppError(
          "Autenticación requerida",
          401,
          "AUTHENTICATION_REQUIRED",
        );
      }
      if (
        !req.auth.permissions?.has(permission) &&
        !req.auth.permissions?.has("*")
      ) {
        throw new AppError(
          "No tiene permisos para esta operación",
          403,
          "PERMISSION_DENIED",
          {
            permission,
          },
        );
      }
      return next();
    } catch (error) {
      return handleError(error, res);
    }
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth?.roles?.has(role))
      return res
        .status(403)
        .json({
          error: "Esta operación requiere el rol de propietario",
          code: "ROLE_REQUIRED",
        });
    next();
  };
}
module.exports = { requirePermission, requireRole };
