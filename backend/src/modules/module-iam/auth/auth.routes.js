const express = require("express");
const authController = require("./auth.controller");
const { authenticateBearer } = require("../../../middleware/authentication");
const { rateLimit } = require("express-rate-limit");
const access = require("./accountAccess.service");
const handleError = require("../../../utils/handleError/handleError");
const {
  requestAuditContext,
} = require("../../module-audit/auditLogs/auditContext");
const { clearSessionCookie } = require("../../../utils/security/webSession");

const router = express.Router();
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const limiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Vuelve a intentarlo en unos minutos.",
    code: "RATE_LIMITED",
  },
});
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Inténtalo más tarde.",
    code: "RATE_LIMITED",
  },
});
router.get("/capabilities", (req, res) =>
  res.json({ data: access.capabilities() }),
);
router.post("/login", limiter, (req, res) => authController.login(req, res));
router.post("/web/login", limiter, (req, res) =>
  authController.webLogin(req, res),
);
for (const [path, method, status] of [
  ["register", "register", 201],
  ["forgot-password", "forgot", 202],
  ["reset-password", "reset", 200],
]) {
  router.post(`/${path}`, recoveryLimiter, async (req, res) => {
    try {
      res
        .status(status)
        .json({
          data: await access[method](req.body, requestAuditContext(req)),
        });
    } catch (error) {
      handleError(error, res);
    }
  });
}
function sessionOnly(req, res, next) {
  if (req.auth.type !== "session")
    return res
      .status(403)
      .json({
        error: "Se requiere una sesión de usuario",
        code: "SESSION_REQUIRED",
      });
  next();
}
router.patch("/me", authenticateBearer, sessionOnly, async (req, res) => {
  try {
    res.json({
      data: await access.updateProfile(req.body, {
        auth: req.auth,
        request: requestAuditContext(req),
      }),
    });
  } catch (error) {
    handleError(error, res);
  }
});
router.post(
  "/change-password",
  authenticateBearer,
  sessionOnly,
  recoveryLimiter,
  async (req, res) => {
    try {
      await access.changePassword(req.body, {
        auth: req.auth,
        request: requestAuditContext(req),
      });
      clearSessionCookie(res);
      res.status(204).send();
    } catch (error) {
      handleError(error, res);
    }
  },
);
router.get("/me", authenticateBearer, (req, res) =>
  authController.me(req, res),
);
router.post("/logout", authenticateBearer, (req, res) =>
  authController.logout(req, res),
);

module.exports = router;
