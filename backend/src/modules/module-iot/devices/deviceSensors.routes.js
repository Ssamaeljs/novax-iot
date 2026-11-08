const express = require("express");
const { AutoCrudController } = require("../../../helpers/autoCrud");
const { requirePermission } = require("../../../middleware/authorization");
const handleError = require("../../../utils/handleError/handleError");
const AppError = require("../../../utils/handleError/AppError");
const devices = require("./devices.service");
const sensors = require("../sensors/sensors.service");

const router = express.Router({ mergeParams: true });
const controller = new AutoCrudController(sensors);

// Parent ownership is enforced for every operation, not only by the UI filter.
function operation(action) {
  return async (req, res) => {
    const context = controller.context(req);
    const write = ["create", "update", "delete"].includes(action);
    try {
      const execute = async (transaction) => {
        const device = await devices.findRecord(req.params.device_external_id, context, { transaction, include: [] });
        if (write) {
          await device.reload({ transaction, lock: transaction.LOCK.SHARE });
          if (!device.is_active) throw new AppError("Activa el dispositivo antes de gestionar sus sensores", 409, "DEVICE_INACTIVE");
        }
        const scoped = { ...context, transaction, sensorDeviceId: device.id };
        if (action === "list") {
          if (req.query.device_external_id && req.query.device_external_id !== device.external_id) throw new AppError("El dispositivo de la consulta no coincide con la ruta", 422, "DEVICE_SCOPE_MISMATCH");
          return sensors.list({ ...req.query, device_external_id: device.external_id }, scoped);
        }
        if (action === "get") return sensors.get(req.params.sensor_external_id, scoped);
        if (action === "create") {
          if (req.body?.device_external_id && req.body.device_external_id !== device.external_id) throw new AppError("El sensor debe pertenecer al dispositivo de la ruta", 422, "DEVICE_SCOPE_MISMATCH");
          if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new AppError("El cuerpo debe ser un objeto JSON", 400, "INVALID_BODY");
          return sensors.create({ ...req.body, device_external_id: device.external_id }, scoped);
        }
        if (action === "update") return sensors.update(req.params.sensor_external_id, req.body, scoped);
        return sensors.delete(req.params.sensor_external_id, scoped);
      };
      const result = write ? await sensors.model.sequelize.transaction(execute) : await execute();
      if (action === "delete") return res.status(204).send();
      return res.status(action === "create" ? 201 : 200).json(action === "list" ? result : { data: result });
    } catch (error) { return handleError(error, res); }
  };
}

router.use(requirePermission("devices.read"));
router.get("/", requirePermission("sensors.read"), operation("list"));
router.get("/:sensor_external_id", requirePermission("sensors.read"), operation("get"));
router.post("/", requirePermission("sensors.manage"), operation("create"));
router.patch("/:sensor_external_id", requirePermission("sensors.manage"), operation("update"));
router.delete("/:sensor_external_id", requirePermission("sensors.manage"), operation("delete"));
module.exports = router;
