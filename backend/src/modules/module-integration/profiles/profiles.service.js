const { IntegrationProfile, sequelize } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const DynamicValidator = require("../../../helpers/autoCrud/DynamicValidator");
const { validateMappings, onlyKeys } = require("../normalization/contract");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
const schema = { name: { required: true, type: "string", minLength: 2, maxLength: 120 }, description: { type: "string", allowNull: true, maxLength: 2000 }, mappings: { required: true, type: "array" } };
class ProfileService extends AutoCrudService {
  constructor() {
    super({ model: IntegrationProfile, automaticCodePrefix: "PRF", writableFields: ["code", "name", "description", "mappings", "is_active"], searchableFields: ["code", "name"], filterableFields: ["is_active"],
      schemas: { create: schema, update: { name: schema.name, description: schema.description, is_active: { type: "boolean" } } },
      hooks: { beforeCreate(payload) { payload.mappings = validateMappings(payload.mappings); } },
    });
  }
  async newVersion(externalId, input, context) {
    onlyKeys(input, Object.keys(schema));
    const payload = await new DynamicValidator().validate(schema, input);
    payload.mappings = validateMappings(payload.mappings);
    return sequelize.transaction(async (transaction) => {
      const base = await this.findRecord(externalId, context, { transaction });
      // All versions of one family lock the same first row, not their chosen parent.
      await IntegrationProfile.findOne({ where: { tenant_id: context.auth.tenantId, code: base.code }, order: [["version", "ASC"]], transaction, lock: transaction.LOCK.UPDATE });
      const version = await IntegrationProfile.max("version", { where: { tenant_id: context.auth.tenantId, code: base.code }, transaction });
      const record = await IntegrationProfile.create({ ...payload, tenant_id: context.auth.tenantId, code: base.code, version: version + 1 }, { transaction });
      await recordAudit({ context, action: "CREATE", resource: "integration_profiles", resourceId: record.external_id, details: { version: record.version }, transaction });
      return this.serialize(record);
    });
  }
}
module.exports = new ProfileService();
