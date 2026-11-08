const { Sensor, Device, Measurement } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");

const service = new AutoCrudService({
  model: Sensor,
  scope: (context) => context.sensorDeviceId ? { device_id: context.sensorDeviceId } : {},
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
        payload.minimum_value != null &&
        payload.maximum_value != null &&
        payload.minimum_value > payload.maximum_value
      ) {
        throw new AppError("minimum_value no puede ser mayor que maximum_value", 422, "INVALID_RANGE");
      }
    }],
  },
  hooks: {
    beforeUpdate: async (record, payload, _context, transaction) => {
      await record.reload({ transaction, lock: transaction.LOCK.UPDATE });
      const minimum = Object.hasOwn(payload, "minimum_value") ? payload.minimum_value : record.minimum_value;
      const maximum = Object.hasOwn(payload, "maximum_value") ? payload.maximum_value : record.maximum_value;
      if (minimum != null && maximum != null && Number(minimum) > Number(maximum)) throw new AppError("El mínimo no puede superar al máximo", 422, "INVALID_RANGE");
      const changed = ["key", "metric", "unit", "data_type"].some((field) => Object.hasOwn(payload, field) && payload[field] !== record[field]);
      if (changed && await Measurement.findOne({ where: { tenant_id: record.tenant_id, sensor_id: record.id }, attributes: ["external_id"], transaction })) throw new AppError("Este sensor ya tiene histórico. Crea otro sensor para cambiar clave, magnitud, unidad o tipo.", 409, "SENSOR_SCHEMA_IN_USE");
    },
    transformInput: async (operation, input, context, transaction) => {
      const payload = { ...input };
      if (operation === "create") {
        const device = await Device.findOne({
          where: { external_id: payload.device_external_id, tenant_id: context.auth.tenantId, is_active: true },
          transaction,
          lock: transaction.LOCK.SHARE,
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

// Keep the existing CRUD, adding a scoped, paginated device view without N+1 reads.
const list = service.list.bind(service);
service.list = async (query = {}, context = {}) => {
  let scopedContext = context;
  if (query.device_external_id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(query.device_external_id))) throw new AppError("Dispositivo inválido", 422, "INVALID_EXTERNAL_ID");
    const device = await Device.findOne({ where: { external_id: query.device_external_id, tenant_id: context.auth.tenantId }, transaction: context.transaction });
    if (!device) throw new AppError("Dispositivo no encontrado", 404, "DEVICE_NOT_FOUND");
    scopedContext = { ...context, sensorDeviceId: device.id };
  }
  const latest = String(query.include_latest) === "true";
  if (latest && !context.auth.permissions?.has("measurements.read") && !context.auth.permissions?.has("*")) throw new AppError("No tiene permiso para consultar mediciones", 403, "PERMISSION_DENIED");
  const result = await list(query, scopedContext);
  if (latest && result.data.length) {
    const { QueryTypes } = require("sequelize");
    const measurements = require("../measurements/measurements.service");
    const rows = await Sensor.sequelize.query(`
      SELECT m.*, s.external_id AS sensor_external_id
      FROM iot.sensors s JOIN LATERAL (
        SELECT * FROM iot.measurements
        WHERE tenant_id = s.tenant_id AND sensor_id = s.id
        ORDER BY observed_at DESC, id DESC LIMIT 1
      ) m ON TRUE
      WHERE s.tenant_id = :tenant AND s.external_id IN (:sensors)`, {
      replacements: { tenant: context.auth.tenantId, sensors: result.data.map((sensor) => sensor.external_id) },
      type: QueryTypes.SELECT, transaction: context.transaction,
    });
    const bySensor = new Map(rows.map((row) => [row.sensor_external_id, measurements.serialize(row)]));
    result.data = result.data.map((sensor) => ({ ...sensor, latest_measurement: bySensor.get(sensor.external_id) || null }));
    const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
    await recordAudit({ context, action: "LIST", resource: "measurements", statusCode: 200, details: { view: "latest_per_sensor", result_count: rows.length }, transaction: context.transaction });
  }
  return result;
};
module.exports = service;

