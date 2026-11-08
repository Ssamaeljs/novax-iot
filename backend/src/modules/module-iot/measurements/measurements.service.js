const { Op } = require("sequelize");
const { Measurement, Sensor, Device } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");

class MeasurementService extends AutoCrudService {
  constructor() {
    super({
      model: Measurement,
      writableFields: [
        "device_id",
        "sensor_id",
        "observed_at",
        "received_at",
        "value_number",
        "value_text",
        "value_boolean",
        "value_json",
        "quality",
        "sequence",
        "source_payload",
        "integration_message_id", "metric_snapshot", "unit_snapshot",
      ],
      virtualFields: ["sensor_external_id", "value"],
      hiddenFields: ["tenant_id", "device_id", "sensor_id"],
      filterableFields: ["quality"],
      sortableFields: ["observed_at", "received_at", "id"],
      defaultSort: ["observed_at", "DESC"],
      softDeleteField: null,
      include: [
        { model: Sensor, as: "sensor", attributes: ["external_id", "key", "name", "metric", "unit", "data_type"] },
        { model: Device, as: "device", attributes: ["external_id", "code", "name"] },
      ],
      schemas: {
        create: {
          sensor_external_id: { required: true, type: "string", format: "uuid" },
          observed_at: { required: true, type: "string", format: "date" },
          value: { required: true, allowNull: false },
          quality: { type: "string", uppercase: true, oneOf: ["GOOD", "UNCERTAIN", "BAD"] },
          sequence: { type: "string", maxLength: 80, allowNull: true },
          source_payload: { type: "object", allowNull: true },
        },
      },
      hooks: {
        transformInput: async (_operation, input, context, transaction) => {
          const sensor = await Sensor.findOne({
            where: { external_id: input.sensor_external_id, tenant_id: context.auth.tenantId, is_active: true },
            transaction,
            lock: transaction.LOCK.SHARE,
          });
          if (!sensor) throw new AppError("Sensor no encontrado", 404, "SENSOR_NOT_FOUND");

          const payload = {
            sensor_id: sensor.id,
            device_id: sensor.device_id,
            observed_at: new Date(input.observed_at),
            received_at: context.receivedAt || new Date(),
            integration_message_id: context.ingestionMessageId || null,
            metric_snapshot: sensor.metric,
            unit_snapshot: sensor.unit,
            quality: input.quality || "GOOD",
            sequence: input.sequence,
            source_payload: input.source_payload,
          };

          const type = sensor.data_type;
          if (type === "NUMBER" && typeof input.value === "number" && Number.isFinite(input.value)) {
            payload.value_number = input.value;
          } else if (type === "TEXT" && typeof input.value === "string") {
            payload.value_text = input.value;
          } else if (type === "BOOLEAN" && typeof input.value === "boolean") {
            payload.value_boolean = input.value;
          } else if (type === "JSON" && input.value !== null && typeof input.value === "object") {
            payload.value_json = input.value;
          } else {
            throw new AppError(`El valor no coincide con el tipo ${type} del sensor`, 422, "MEASUREMENT_TYPE_MISMATCH");
          }
          return payload;
        },
      },
    });
  }

  serialize(record) {
    const value = super.serialize(record);
    if (value.sensor && value.metric_snapshot) value.sensor = { ...value.sensor, metric: value.metric_snapshot, unit: value.unit_snapshot };
    if (value.value_number !== null && value.value_number !== undefined) value.value = value.value_number;
    else if (value.value_text !== null && value.value_text !== undefined) value.value = value.value_text;
    else if (value.value_boolean !== null && value.value_boolean !== undefined) value.value = value.value_boolean;
    else value.value = value.value_json;
    delete value.value_number;
    delete value.value_text;
    delete value.value_boolean;
    delete value.value_json;
    return value;
  }

  async list(query = {}, context = {}) {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(query.page_size, 10) || 100, 1), 500);
    const where = { tenant_id: context.auth.tenantId };

    if (query.sensor_external_id) {
      const sensor = await Sensor.findOne({
        where: { external_id: query.sensor_external_id, tenant_id: context.auth.tenantId },
        attributes: ["id"],
        transaction: context.transaction,
      });
      if (!sensor) throw new AppError("Sensor no encontrado", 404, "SENSOR_NOT_FOUND");
      where.sensor_id = sensor.id;
    }
    if (query.device_external_id) {
      const device = await Device.findOne({
        where: { external_id: query.device_external_id, tenant_id: context.auth.tenantId },
        attributes: ["id"],
        transaction: context.transaction,
      });
      if (!device) throw new AppError("Dispositivo no encontrado", 404, "DEVICE_NOT_FOUND");
      where.device_id = device.id;
    }
    if (query.quality) where.quality = query.quality;
    if (query.from || query.to) {
      where.observed_at = {};
      if (query.from) where.observed_at[Op.gte] = this.#parseDate(query.from, "from");
      if (query.to) where.observed_at[Op.lte] = this.#parseDate(query.to, "to");
    }

    const result = await Measurement.findAndCountAll({
      where,
      include: this.include,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [["observed_at", "DESC"], ["id", "DESC"]],
      transaction: context.transaction,
    });
    await recordAudit({
      context,
      action: "LIST",
      resource: "measurements",
      statusCode: 200,
      details: { result_count: result.rows.length },
      transaction: context.transaction,
    });
    return {
      data: result.rows.map((row) => this.serialize(row)),
      pagination: {
        page,
        page_size: pageSize,
        total: result.count,
        total_pages: Math.ceil(result.count / pageSize),
      },
    };
  }

  async bulkCreate(items, context = {}) {
    if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
      throw new AppError("measurements debe contener entre 1 y 500 elementos", 422, "INVALID_BATCH_SIZE");
    }
    return this.model.sequelize.transaction(async (transaction) => {
      const results = [];
      for (const item of items) {
        results.push(await this.create(item, { ...context, transaction, suppressAudit: true }));
      }
      await recordAudit({
        context: { ...context, transaction },
        action: "BULK_CREATE",
        resource: "measurements",
        statusCode: 201,
        details: { measurement_count: results.length },
        transaction,
      });
      return results;
    });
  }

  #parseDate(value, field) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(`${field} debe ser una fecha válida`, 422, "INVALID_DATE");
    }
    return parsed;
  }
}

module.exports = new MeasurementService();

