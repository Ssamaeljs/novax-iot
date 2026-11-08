const { randomBytes } = require("node:crypto");
const { IntegrationSource, IntegrationProfile, Device, sequelize } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const { hashToken } = require("../../../utils/security/apiToken");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
const AppError = require("../../../utils/handleError/AppError");
const secret = () => `nvx_ingest_${randomBytes(32).toString("base64url")}`;
const name = { required: true, type: "string", minLength: 2, maxLength: 120 };
const timeout = { type: "integer", min: 30, max: 86400 };
class SourceService extends AutoCrudService {
  constructor() {
    super({ model: IntegrationSource, writableFields: ["name", "device_id", "profile_id", "transport", "token_hash", "token_prefix", "heartbeat_timeout_seconds", "is_active"],
      searchableFields: ["name"], filterableFields: ["is_active", "transport"],
      include: [{ model: Device, as: "device", attributes: ["external_id", "name", "protocol", "is_active"] }, { model: IntegrationProfile, as: "profile", attributes: ["external_id", "name", "code", "version", "is_active"] }],
      schemas: { create: { name, device_external_id: { required: true, type: "string", format: "uuid" }, profile_external_id: { required: true, type: "string", format: "uuid" }, transport: { required: true, type: "string", oneOf: ["HTTPS", "MQTT"] }, heartbeat_timeout_seconds: timeout }, update: { name, is_active: { type: "boolean" }, heartbeat_timeout_seconds: timeout } },
      hooks: { transformInput: async (operation, input, context, transaction) => {
        if (operation !== "create") return input;
        const device = await Device.findOne({ where: { external_id: input.device_external_id, tenant_id: context.auth.tenantId, is_active: true }, transaction });
        const profile = await IntegrationProfile.findOne({ where: { external_id: input.profile_external_id, tenant_id: context.auth.tenantId, is_active: true }, transaction });
        if (!device || !profile) throw new AppError("Selecciona un dispositivo y un perfil activos de NOVAX", 422, "INVALID_INTEGRATION_BINDING");
        if (device.protocol !== input.transport && !(input.transport === "HTTPS" && device.protocol === "HTTP")) throw new AppError("El transporte no coincide con el dispositivo", 422, "TRANSPORT_MISMATCH");
        return { ...input, device_id: device.id, profile_id: profile.id };
      }, beforeCreate(payload, context) { payload.token_hash = hashToken(context.sourceSecret); payload.token_prefix = context.sourceSecret.slice(0, 20); } },
    });
  }
  async create(input, context = {}) {
    const token = secret();
    const record = await super.create(input, { ...context, sourceSecret: token });
    return { ...record, token };
  }
  serialize(record) {
    const output = super.serialize(record);
    output.https_path = `/v1/api/ingest/https/${output.external_id}`;
    output.mqtt_topic = `novax/v1/sources/${output.external_id}/telemetry`;
    return output;
  }
  async rotate(externalId, context) {
    return sequelize.transaction(async (transaction) => {
      const record = await this.findRecord(externalId, context, { transaction, include: [] });
      const token = secret();
      await record.update({ token_hash: hashToken(token), token_prefix: token.slice(0, 20) }, { transaction });
      await recordAudit({ context, action: "UPDATE", resource: "integration_sources", resourceId: externalId, details: { credential_rotated: true }, transaction });
      return { external_id: externalId, token };
    });
  }
}
module.exports = new SourceService();
