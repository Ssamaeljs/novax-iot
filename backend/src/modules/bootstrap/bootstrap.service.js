const bcrypt = require("bcrypt");
const {
  sequelize,
  Tenant,
  User,
  Account,
  Role,
  Permission,
  ApiToken,
} = require("../../config/models");
const DynamicValidator = require("../../helpers/autoCrud/DynamicValidator");
const AppError = require("../../utils/handleError/AppError");
const { generateApiToken, safeEqual } = require("../../utils/security/apiToken");
const { recordAudit } = require("../module-audit/auditLogs/auditWriter");

const schema = {
  tenant_name: { required: true, type: "string", minLength: 2, maxLength: 120 },
  tenant_slug: { required: true, type: "string", lowercase: true, format: "slug", maxLength: 80 },
  timezone: { type: "string", maxLength: 64 },
  first_name: { required: true, type: "string", minLength: 2, maxLength: 120 },
  last_name: { required: true, type: "string", minLength: 1, maxLength: 120 },
  id_card: {
    required: true,
    type: "string",
    uppercase: true,
    minLength: 5,
    maxLength: 30,
    pattern: /^[A-Z0-9-]+$/,
  },
  username: { required: true, type: "string", lowercase: true, minLength: 3, maxLength: 80 },
  email: { required: true, type: "string", lowercase: true, format: "email", maxLength: 160 },
  password: { required: true, type: "string", minLength: 12, maxLength: 128, trim: false },
  token_name: { type: "string", minLength: 2, maxLength: 120 },
};

class BootstrapService {
  async execute(input, providedSecret, request = {}) {
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || expectedSecret.length < 32) {
      throw new AppError("BOOTSTRAP_SECRET no está configurado de forma segura", 503, "BOOTSTRAP_NOT_CONFIGURED");
    }
    if (!safeEqual(providedSecret, expectedSecret)) {
      throw new AppError("Bootstrap no autorizado", 401, "INVALID_BOOTSTRAP_SECRET");
    }

    const payload = await new DynamicValidator().validate(schema, input);
    const generated = generateApiToken();

    return sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(672903145)", { transaction });
      const existingTokens = await ApiToken.count({ transaction });
      if (existingTokens > 0) {
        throw new AppError("El bootstrap ya fue ejecutado", 409, "BOOTSTRAP_ALREADY_COMPLETED");
      }

      const tenant = await Tenant.create(
        {
          name: payload.tenant_name,
          slug: payload.tenant_slug,
          timezone: payload.timezone || "UTC",
        },
        { transaction },
      );
      const user = await User.create(
        {
          tenant_id: tenant.id,
          first_name: payload.first_name,
          last_name: payload.last_name,
          id_card: payload.id_card,
          id_card: payload.id_card,
          is_active: true,
        },
        { transaction },
      );
      const account = await Account.create(
        {
          tenant_id: tenant.id,
          user_id: user.id,
          username: payload.username,
          email: payload.email,
          password_hash: await bcrypt.hash(payload.password, 12),
          is_active: true,
        },
        { transaction },
      );
      const role = await Role.create(
        {
          tenant_id: tenant.id,
          code: "TENANT_OWNER",
          name: "Tenant owner",
          description: "Rol propietario creado durante el bootstrap",
          is_system: true,
          is_active: true,
        },
        { transaction },
      );
      const permissions = await Permission.findAll({ where: { is_active: true }, transaction });
      await role.setPermissions(permissions, { transaction });
      await account.setRoles([role], { transaction });
      const apiToken = await ApiToken.create(
        {
          tenant_id: tenant.id,
          account_id: account.id,
          name: payload.token_name || "Bootstrap owner token",
          token_prefix: generated.tokenPrefix,
          token_hash: generated.tokenHash,
          scopes: [],
          is_active: true,
        },
        { transaction },
      );

      await recordAudit({
        context: {
          request,
          auth: {
            tenantId: tenant.id,
            accountId: account.id,
            accountExternalId: account.external_id,
            userId: user.id,
            userExternalId: user.external_id,
            tokenId: apiToken.id,
            tokenExternalId: apiToken.external_id,
          },
        },
        action: "BOOTSTRAP",
        resource: "tenants",
        resourceId: tenant.external_id,
        statusCode: 201,
        transaction,
      });

      return {
        tenant: { external_id: tenant.external_id, name: tenant.name, slug: tenant.slug },
        user: { external_id: user.external_id, first_name: user.first_name, last_name: user.last_name },
        account: { external_id: account.external_id, username: account.username, email: account.email },
        role: { external_id: role.external_id, code: role.code },
        api_token: {
          external_id: apiToken.external_id,
          prefix: apiToken.token_prefix,
          token: generated.token,
          warning: "Este token solo se muestra una vez",
        },
      };
    });
  }
}

module.exports = new BootstrapService();
