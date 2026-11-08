const { Device } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");

module.exports = new AutoCrudService({
  model: Device,
  automaticCodePrefix: "DEV",
  writableFields: [
    "code",
    "name",
    "device_type",
    "protocol",
    "manufacturer",
    "model",
    "serial_number",
    "firmware_version",
    "status",
    "last_seen_at",
    "metadata",
    "is_active",
  ],
  filterableFields: ["device_type", "protocol", "status", "is_active"],
  searchableFields: ["code", "name", "manufacturer", "model", "serial_number"],
  sortableFields: ["code", "name", "status", "last_seen_at", "created_at"],
  schemas: {
    create: {
      name: { required: true, type: "string", minLength: 2, maxLength: 120 },
      device_type: { required: true, type: "string", uppercase: true, minLength: 2, maxLength: 60 },
      protocol: {
        required: true,
        type: "string",
        uppercase: true,
        oneOf: ["MQTT", "HTTPS"],
      },
      manufacturer: { type: "string", maxLength: 100, allowNull: true },
      model: { type: "string", maxLength: 100, allowNull: true },
      serial_number: { type: "string", maxLength: 120, allowNull: true },
      firmware_version: { type: "string", maxLength: 60, allowNull: true },
      status: { type: "string", uppercase: true, oneOf: ["ONLINE", "OFFLINE", "DEGRADED", "UNKNOWN"] },
      last_seen_at: { type: "string", format: "date", allowNull: true },
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
    update: {
      name: { type: "string", minLength: 2, maxLength: 120 },
      device_type: { type: "string", uppercase: true, minLength: 2, maxLength: 60 },
      protocol: { type: "string", uppercase: true, oneOf: ["MQTT", "HTTP", "HTTPS", "ONVIF"] },
      manufacturer: { type: "string", maxLength: 100, allowNull: true },
      model: { type: "string", maxLength: 100, allowNull: true },
      serial_number: { type: "string", maxLength: 120, allowNull: true },
      firmware_version: { type: "string", maxLength: 60, allowNull: true },
      status: { type: "string", uppercase: true, oneOf: ["ONLINE", "OFFLINE", "DEGRADED", "UNKNOWN"] },
      last_seen_at: { type: "string", format: "date", allowNull: true },
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
  },
  hooks: {
    beforeUpdate(record, payload) {
      if (["HTTP", "ONVIF"].includes(payload.protocol) && record.protocol !== payload.protocol) throw new AppError("Las nuevas integraciones admiten HTTPS o MQTT", 422, "LEGACY_PROTOCOL_READ_ONLY");
    },
    transformInput: async (_operation, input) => ({
      ...input,
      ...(input.last_seen_at ? { last_seen_at: new Date(input.last_seen_at) } : {}),
    }),
  },
});

