const express = require("express");
const { AutoCrudController, createAutoCrudRouter } = require("../../helpers/autoCrud");
const { requirePermission } = require("../../middleware/authorization");
const { Device, Sensor } = require("../../config/models");
const profiles = require("./profiles/profiles.service");
const sources = require("./sources/sources.service");
const { normalize, validateEnvelope, onlyKeys } = require("./normalization/contract");
const handleError = require("../../utils/handleError/handleError");
const AppError = require("../../utils/handleError/AppError");
const { recordAudit } = require("../module-audit/auditLogs/auditWriter");
const router = express.Router();
const permissions = { read: "integrations.read", manage: "integrations.manage" };
const profileController = new AutoCrudController(profiles), sourceController = new AutoCrudController(sources);
router.get("/status", requirePermission(permissions.read), (_req, res) => res.json({ data: require("./runtime").status() }));
router.post("/profiles/:external_id/versions", requirePermission(permissions.manage), async (req, res) => {
  try { return res.status(201).json({ data: await profiles.newVersion(req.params.external_id, req.body, profileController.context(req)) }); } catch (error) { return handleError(error, res); }
});
router.post("/profiles/:external_id/preview", requirePermission(permissions.manage), async (req, res) => {
  try {
    onlyKeys(req.body, ["device_external_id", "message"]);
    const context = profileController.context(req), profile = await profiles.findRecord(req.params.external_id, context);
    const device = await Device.findOne({ where: { external_id: req.body.device_external_id, tenant_id: req.auth.tenantId, is_active: true } });
    if (!device) throw new AppError("Dispositivo no disponible", 422, "INVALID_INTEGRATION_BINDING");
    const sensors = await Sensor.findAll({ where: { device_id: device.id, tenant_id: req.auth.tenantId, is_active: true } });
    const { envelope } = validateEnvelope(req.body.message);
    const readings = normalize(profile, envelope, sensors, new Date());
    await recordAudit({ context, action: "READ", resource: "integration_profiles", resourceId: profile.external_id, details: { preview: true } });
    return res.json({ data: { schema_version: 1, device_external_id: device.external_id, readings } });
  } catch (error) { return handleError(error, res); }
});
router.post("/sources/:external_id/rotate", requirePermission(permissions.manage), async (req, res) => {
  try { return res.json({ data: await sources.rotate(req.params.external_id, sourceController.context(req)) }); } catch (error) { return handleError(error, res); }
});
router.use("/profiles", createAutoCrudRouter({ controller: profileController, permissions }));
router.use("/sources", createAutoCrudRouter({ controller: sourceController, permissions }));
const messages = require("./ingestion/messages.service");
router.use("/messages", createAutoCrudRouter({ controller: new AutoCrudController(messages), permissions, methods: { create: false, update: false, delete: false } }));
module.exports = router;
