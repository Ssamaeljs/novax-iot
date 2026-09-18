const { Sensor, Device } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");

module.exports = new AutoCrudService({
  model: Sensor,
  writableFields: [
    "device_id",
    "key",
    "name",
    "metric",
    "unit",
    "data_type",
    "minimum_value",
    "maximum_value",
    "sampling_interval_seconds",
    "calibration",
    "metadata",
    "is_active",
  ],
  virtualFields: ["device_external_id"],
  hiddenFields: ["id", "tenant_id", "device_id"],
  filterableFields: ["metric", "data_type", "is_active"],
  searchableFields: ["key", "name", "metric", "unit"],
  sortableFields: ["key", "name", "metric", "created_at"],
  include: [{ model: Device, as: "device", attributes: ["external_id", "code", "name"] }],
  schemas: {
    create: {
      device_external_id: { required: true, type: "string", format: "uuid" },
      key: { required: true, type: "string", lowercase: true, minLength: 1, maxLength: 80 },
      name: { required: true, type: "string", minLength: 2, maxLength: 120 },
      metric: { required: true, type: "string", lowercase: true, minLength: 2, maxLength: 100 },
      unit: { type: "string", maxLength: 30, allowNull: true },
      data_type: { type: "string", uppercase: true, oneOf: ["NUMBER", "TEXT", "BOOLEAN", "JSON"] },
      minimum_value: { type: "number", allowNull: true },
      maximum_value: { type: "number", allowNull: true },
      sampling_interval_seconds: { type: "integer", min: 1, allowNull: true },
      calibration: { type: "object" },
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
    update: {
      device_external_id: { type: "string", format: "uuid" },
      key: { type: "string", lowercase: true, minLength: 1, maxLength: 80 },
      name: { type: "string", minLength: 2, maxLength: 120 },
      metric: { type: "string", lowercase: true, minLength: 2, maxLength: 100 },
      unit: { type: "string", maxLength: 30, allowNull: true },
      data_type: { type: "string", uppercase: true, oneOf: ["NUMBER", "TEXT", "BOOLEAN", "JSON"] },
      minimum_value: { type: "number", allowNull: true },
      maximum_value: { type: "number", allowNull: true },
      sampling_interval_seconds: { type: "integer", min: 1, allowNull: true },
      calibration: { type: "object" },
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
  },
  validators: {
    create: [async (payload) => {
      if (
        payload.minimum_value !== undefined &&
        payload.maximum_value !== undefined &&
        payload.minimum_value > payload.maximum_value
      ) {
        throw new AppError("minimum_value no puede ser mayor que maximum_value", 422, "INVALID_RANGE");
      }
    }],
  },
  hooks: {
    transformInput: async (operation, input, context, transaction) => {
      const payload = { ...input };
      if (operation === "create") {
        const device = await Device.findOne({
          where: { external_id: payload.device_external_id, tenant_id: context.auth.tenantId, is_active: true },
          transaction,
        });
        if (!device) throw new AppError("Dispositivo no encontrado", 404, "DEVICE_NOT_FOUND");
        payload.device_id = device.id;
      } else if (payload.device_external_id) {
        throw new AppError("No se puede cambiar el dispositivo de un sensor", 422, "IMMUTABLE_FIELD");
      }
      delete payload.device_external_id;
      return payload;
    },
  },
});

