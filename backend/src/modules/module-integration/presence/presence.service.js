const { Op } = require("sequelize");
const { IntegrationSource, IntegrationProfile, Device, Tenant, sequelize } = require("../../../config/models");
const { organizationScope } = require("../../../config/organization");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");

async function expire(now = new Date()) {
  const tenant = await Tenant.findOne({ where: organizationScope(), attributes: ["id"] });
  if (!tenant) return 0;
  const sources = await IntegrationSource.findAll({ where: { tenant_id: tenant.id }, attributes: ["device_id", "heartbeat_timeout_seconds", "is_active"], include: [{ model: IntegrationProfile, as: "profile", attributes: ["is_active"] }] });
  const deadlines = new Map(), active = new Map();
  for (const source of sources) {
    deadlines.set(source.device_id, Math.max(deadlines.get(source.device_id) || 0, source.heartbeat_timeout_seconds));
    if (source.is_active && source.profile?.is_active) active.set(source.device_id, Math.max(active.get(source.device_id) || 0, source.heartbeat_timeout_seconds));
  }
  // Disabling the last source must not leave a device ONLINE indefinitely.
  for (const [deviceId, seconds] of active) deadlines.set(deviceId, seconds);
  let count = 0;
  for (const [deviceId, seconds] of deadlines) await sequelize.transaction(async (transaction) => {
    const [changed, rows] = await Device.update({ status: "OFFLINE" }, { where: { id: deviceId, tenant_id: tenant.id, is_active: true, status: "ONLINE", last_seen_at: { [Op.lt]: new Date(now.getTime() - seconds * 1000) } }, returning: true, transaction });
    for (const device of rows) await recordAudit({ context: { auth: { tenantId: tenant.id } }, action: "UPDATE", resource: "devices", resourceId: device.external_id, details: { actor_type: "SYSTEM", status: "OFFLINE", reason: "TELEMETRY_TIMEOUT" }, transaction });
    count += changed;
  });
  return count;
}
module.exports = { expire };
