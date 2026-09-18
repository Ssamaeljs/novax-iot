const express = require("express");
const auditLogsController = require("./auditLogs.controller");
const { requirePermission } = require("../../../middleware/authorization");

const router = express.Router();
router.get("/", requirePermission("audit_logs.read"), (req, res) => auditLogsController.list(req, res));
router.get("/:external_id", requirePermission("audit_logs.read"), (req, res) => auditLogsController.get(req, res));

module.exports = router;
