const router = require("express").Router();
const controller = require("./projects.controller");
const { requirePermission } = require("../../../middleware/authorization");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");
router.get("/:external_id/board", requirePermission("projects.read"), (req, res) => controller.readBoard(req, res));
router.put("/:external_id/board", requirePermission("projects.manage"), requirePermission("sensors.read"), (req, res) => controller.saveBoard(req, res));
router.get("/:external_id/telemetry", requirePermission("projects.read"), requirePermission("measurements.read"), (req, res) => controller.telemetry(req, res));
router.use(createAutoCrudRouter({ controller, permissions: { read: "projects.read", manage: "projects.manage" } }));
module.exports = router;
