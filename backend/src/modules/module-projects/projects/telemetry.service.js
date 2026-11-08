const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../../config/models");
const { activeProject, widgetsFor, sensorPublic } = require("./board.service");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
const AppError = require("../../../utils/handleError/AppError");
const ranges = { "1h": 3600000, "6h": 21600000, "24h": 86400000, "7d": 604800000 };

async function read(externalId, query, context) {
  const duration = Object.hasOwn(ranges, query.range || "24h") ? ranges[query.range || "24h"] : null;
  if (!duration) throw new AppError("Selecciona un periodo válido", 422, "INVALID_TELEMETRY_RANGE");
  const project = await activeProject(externalId, context, context.transaction);
  const widgets = await widgetsFor(project, context, context.transaction);
  const sensors = [...new Map(widgets.flatMap((widget) => widget.sensors).map((sensor) => [sensor.id, sensor])).values()];
  const to = new Date();
  const from = new Date(to.getTime() - duration);
  let latest = [];
  let history = [];
  if (sensors.length) {
    const options = { type: QueryTypes.SELECT, replacements: { tenantId: context.auth.tenantId, sensorIds: sensors.map((sensor) => sensor.id), from, to }, transaction: context.transaction };
    latest = await sequelize.query(`SELECT DISTINCT ON (sensor_id) sensor_id, observed_at, received_at, quality,
      value_number, value_text, value_boolean, value_json FROM iot.measurements
      WHERE tenant_id = :tenantId AND sensor_id IN (:sensorIds)
      ORDER BY sensor_id, observed_at DESC, id DESC`, options);
    history = await sequelize.query(`SELECT sensor_id, observed_at, value_number, quality FROM (
      SELECT sensor_id, observed_at, value_number, quality,
        ROW_NUMBER() OVER (PARTITION BY sensor_id ORDER BY observed_at DESC, id DESC) AS sample_rank
      FROM iot.measurements WHERE tenant_id = :tenantId AND sensor_id IN (:sensorIds)
        AND observed_at BETWEEN :from AND :to AND value_number IS NOT NULL
      ) samples WHERE sample_rank <= 200 ORDER BY sensor_id, observed_at ASC`, options);
  }
  const histories = new Map();
  for (const row of history) {
    if (!histories.has(row.sensor_id)) histories.set(row.sensor_id, []);
    histories.get(row.sensor_id).push({ observed_at: row.observed_at, value: row.value_number, quality: row.quality });
  }
  const latestById = new Map(latest.map((row) => [row.sensor_id, row]));
  await recordAudit({ context, action: "READ", resource: "project_telemetry", resourceId: externalId, details: { sensor_count: sensors.length }, transaction: context.transaction });
  return {
    from, to, sample_limit: 200,
    series: sensors.map((sensor) => {
      const row = latestById.get(sensor.id);
      return { sensor: sensorPublic(sensor), latest: row ? { value: row.value_number ?? row.value_text ?? row.value_boolean ?? row.value_json, observed_at: row.observed_at, received_at: row.received_at, quality: row.quality } : null, points: histories.get(sensor.id) || [] };
    }),
  };
}
module.exports = { read };
