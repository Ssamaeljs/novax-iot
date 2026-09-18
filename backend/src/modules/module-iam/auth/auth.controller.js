const authService = require("./auth.service");
const { requestAuditContext } = require("../../module-audit/auditLogs/auditContext");
const handleError = require("../../../utils/handleError/handleError");

class AuthController {
  async login(req, res) {
    try {
      const data = await authService.login(req.body, requestAuditContext(req));
      return res.status(201).json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }

  async logout(req, res) {
    try {
      await authService.logout({ auth: req.auth, request: requestAuditContext(req) });
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  }

  async me(req, res) {
    try {
      const data = await authService.me({ auth: req.auth, request: requestAuditContext(req) });
      return res.json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new AuthController();
