const auditLogsService = require("./auditLogs.service");
const { requestAuditContext } = require("./auditContext");
const handleError = require("../../../utils/handleError/handleError");

function context(req) {
  return { auth: req.auth, request: requestAuditContext(req) };
}

class AuditLogsController {
  async list(req, res) {
    try {
      return res.json(await auditLogsService.list(req.query, context(req)));
    } catch (error) {
      return handleError(error, res);
    }
  }

  async get(req, res) {
    try {
      return res.json({ data: await auditLogsService.get(req.params.external_id, context(req)) });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new AuditLogsController();
