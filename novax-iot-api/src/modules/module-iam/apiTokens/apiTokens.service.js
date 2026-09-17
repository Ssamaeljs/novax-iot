const { ApiToken, Account } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");
const { generateApiToken } = require("../../../utils/security/apiToken");

class ApiTokenService extends AutoCrudService {
  constructor() {
    super({
      model: ApiToken,
      writableFields: [
        "account_id",
        "name",
        "token_prefix",
        "token_hash",
        "scopes",
        "expires_at",
        "revoked_at",
        "is_active",
      ],
      virtualFields: ["account_external_id"],
      hiddenFields: ["id", "tenant_id", "account_id", "token_hash"],
      filterableFields: ["is_active"],
      searchableFields: ["name", "token_prefix"],
      sortableFields: ["name", "created_at", "expires_at", "last_used_at"],
      include: [{ model: Account, as: "account", attributes: ["external_id", "username", "email"] }],
      schemas: {
        create: {
          account_external_id: { type: "string", format: "uuid" },
          name: { required: true, type: "string", minLength: 2, maxLength: 120 },
          scopes: { type: "array" },
          expires_at: { type: "string", format: "date", allowNull: true },
        },
        update: {
          name: { type: "string", minLength: 2, maxLength: 120 },
          scopes: { type: "array" },
          expires_at: { type: "string", format: "date", allowNull: true },
          is_active: { type: "boolean" },
        },
      },
      hooks: {
        transformInput: async (operation, input, context, transaction) => {
          const payload = { ...input };
          if (payload.scopes) {
            if (!payload.scopes.every((scope) => typeof scope === "string")) {
              throw new AppError("Todos los scopes deben ser cadenas", 422, "INVALID_SCOPES");
            }
            const invalid = payload.scopes.filter((scope) => !context.auth.permissions.has(scope));
            if (invalid.length) {
              throw new AppError("El token no puede recibir permisos que la cuenta no posee", 403, "SCOPE_ESCALATION", invalid);
            }
            payload.scopes = [...new Set(payload.scopes)];
          }
          if ((operation === "create" || Object.hasOwn(payload, "scopes")) && (!payload.scopes || payload.scopes.length === 0)) {
            throw new AppError("Un token de API debe declarar al menos un scope", 422, "SCOPES_REQUIRED");
          }
          if (payload.expires_at) payload.expires_at = new Date(payload.expires_at);

          if (operation === "create") {
            let accountId = context.auth.accountId;
            if (payload.account_external_id) {
              const account = await Account.findOne({
                where: { external_id: payload.account_external_id, tenant_id: context.auth.tenantId, is_active: true },
                transaction,
              });
              if (!account) throw new AppError("Cuenta no encontrada", 404, "ACCOUNT_NOT_FOUND");
              accountId = account.id;
            }
            const generated = generateApiToken();
            context.generatedApiToken = generated.token;
            payload.account_id = accountId;
            payload.token_prefix = generated.tokenPrefix;
            payload.token_hash = generated.tokenHash;
          }
          delete payload.account_external_id;
          return payload;
        },
        beforeDelete: (record) => {
          record.set("revoked_at", new Date());
        },
      },
    });
  }

  async create(input, context = {}) {
    const created = await super.create(input, context);
    return { ...created, token: context.generatedApiToken };
  }
}

module.exports = new ApiTokenService();
