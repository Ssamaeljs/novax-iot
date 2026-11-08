const { IntegrationSource, IntegrationProfile, IntegrationMessage, Device, Sensor, sequelize } = require("../../../config/models");
const { organizationScope } = require("../../../config/organization");
const { Tenant } = require("../../../config/models");
const { hashToken } = require("../../../utils/security/apiToken");
const { validateEnvelope, normalize, UUID } = require("../normalization/contract");
const measurements = require("../../module-iot/measurements/measurements.service");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
const AppError = require("../../../utils/handleError/AppError");

async function ingest({ sourceExternalId, token, envelope: input, transport, request = {} }) {
  if (typeof sourceExternalId !== "string" || !UUID.test(sourceExternalId) || typeof token !== "string" || !/^nvx_ingest_[A-Za-z0-9_-]{43}$/.test(token)) throw new AppError("Credencial de dispositivo inválida", 401, "INVALID_SOURCE_CREDENTIAL");
  let auditContext;
  try {
    return await sequelize.transaction(async (transaction) => {
      const source = await IntegrationSource.findOne({ where: { external_id: sourceExternalId, token_hash: hashToken(token), is_active: true, transport }, transaction, lock: transaction.LOCK.UPDATE });
      if (!source || !await Tenant.findOne({ where: { ...organizationScope(), id: source.tenant_id }, transaction })) throw new AppError("Credencial de dispositivo inválida", 401, "INVALID_SOURCE_CREDENTIAL");
      auditContext = { auth: { tenantId: source.tenant_id }, request };
      const { envelope, digest } = validateEnvelope(input);
      const profile = await IntegrationProfile.findOne({ where: { id: source.profile_id, tenant_id: source.tenant_id, is_active: true }, transaction, lock: transaction.LOCK.SHARE });
      const device = await Device.findOne({ where: { id: source.device_id, tenant_id: source.tenant_id, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
      if (!profile || !device) throw new AppError("Perfil o dispositivo desactivado", 409, "INTEGRATION_INACTIVE");
      const previous = await IntegrationMessage.findOne({ where: { source_id: source.id, message_id: envelope.message_id }, transaction });
      if (previous) {
        if (previous.payload_hash !== digest) throw new AppError("message_id ya se utilizó con otro contenido", 409, "MESSAGE_ID_CONFLICT");
        return { external_id: previous.external_id, duplicate: true, reading_count: previous.reading_count, normalized: previous.normalized };
      }
      const sensors = await Sensor.findAll({ where: { tenant_id: source.tenant_id, device_id: device.id, is_active: true, key: profile.mappings.map((field) => field.sensor_key) }, transaction, lock: transaction.LOCK.SHARE });
      const receivedAt = new Date();
      const readings = normalize(profile, envelope, sensors, receivedAt);
      const normalized = { schema_version: 1, message_id: envelope.message_id, device_external_id: device.external_id, received_at: receivedAt.toISOString(), source: { external_id: source.external_id, transport, profile_external_id: profile.external_id, profile_version: profile.version }, readings };
      const message = await IntegrationMessage.create({ tenant_id: source.tenant_id, source_id: source.id, profile_id: profile.id, device_id: device.id, message_id: envelope.message_id, payload_hash: digest, received_at: receivedAt, reading_count: readings.length, normalized }, { transaction });
      for (const reading of readings) await measurements.create({ sensor_external_id: reading.sensor_external_id, observed_at: reading.observed_at, value: reading.value, quality: reading.quality, sequence: envelope.message_id }, { ...auditContext, transaction, suppressAudit: true, ingestionMessageId: message.id, receivedAt });
      await device.update({ last_seen_at: receivedAt, status: "ONLINE" }, { transaction });
      await source.update({ last_received_at: receivedAt }, { transaction });
      await recordAudit({ context: auditContext, action: "INGEST", resource: "integration_messages", resourceId: message.external_id, details: { actor_type: "DEVICE_SOURCE", source_external_id: source.external_id, reading_count: readings.length, profile_version: profile.version, transport }, transaction });
      return { external_id: message.external_id, duplicate: false, reading_count: readings.length, normalized };
    });
  } catch (error) {
    if (auditContext && error.isOperational) error.sourceAuthenticated = true;
    if (auditContext && error.isOperational) await recordAudit({ context: auditContext, action: "INGEST", resource: "integration_sources", resourceId: sourceExternalId, outcome: "FAILURE", statusCode: error.status, details: { actor_type: "DEVICE_SOURCE", reason: error.code } });
    throw error;
  }
}
module.exports = { ingest };
