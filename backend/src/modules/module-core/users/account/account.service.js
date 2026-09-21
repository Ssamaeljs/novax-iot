const bcrypt = require("bcrypt");
const { Account, User, Role, Session } = require("../../../../config/models");
const { AutoCrudService } = require("../../../../helpers/autoCrud");
const AppError = require("../../../../utils/handleError/AppError");
const { recordAudit } = require("../../../module-audit/auditLogs/auditWriter");

class AccountService extends AutoCrudService {
  constructor() {
    super({
      model: Account,
      writableFields: [
        "user_id",
        "username",
        "email",
        "password_hash",
        "is_active",
      ],
      virtualFields: ["user_external_id", "password"],
      hiddenFields: [
        "user_id",
        "password_hash",
        "failed_login_attempts",
        "locked_until",
      ],
      filterableFields: ["is_active"],
      searchableFields: ["username", "email"],
      sortableFields: ["username", "email", "created_at"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["external_id", "first_name", "last_name"],
        },
        {
          model: Role,
          as: "roles",
          attributes: ["external_id", "code", "name"],
          through: { attributes: [] },
        },
      ],
      schemas: {
        create: {
          user_external_id: { required: true, type: "string", format: "uuid" },
          username: {
            required: true,
            type: "string",
            lowercase: true,
            minLength: 3,
            maxLength: 80,
          },
          email: {
            required: true,
            type: "string",
            lowercase: true,
            format: "email",
            maxLength: 160,
          },
          password: {
            required: true,
            type: "string",
            minLength: 12,
            maxLength: 128,
            trim: false,
          },
          is_active: { type: "boolean" },
        },
        update: {
          user_external_id: { type: "string", format: "uuid" },
          username: {
            type: "string",
            lowercase: true,
            minLength: 3,
            maxLength: 80,
          },
          email: {
            type: "string",
            lowercase: true,
            format: "email",
            maxLength: 160,
          },
          password: {
            type: "string",
            minLength: 12,
            maxLength: 128,
            trim: false,
          },
          is_active: { type: "boolean" },
        },
      },
      hooks: {
        transformInput: async (operation, input, context, transaction) => {
          const payload = { ...input };
          if (operation === "create") {
            const user = await User.findOne({
              where: {
                external_id: payload.user_external_id,
                tenant_id: context.auth.tenantId,
              },
              transaction,
            });
            if (!user)
              throw new AppError(
                "Usuario no encontrado",
                404,
                "USER_NOT_FOUND",
              );
            payload.user_id = user.id;
          } else if (payload.user_external_id) {
            throw new AppError(
              "No se puede cambiar el usuario de una cuenta",
              422,
              "IMMUTABLE_FIELD",
            );
          }
          delete payload.user_external_id;
          if (payload.password)
            payload.password_hash = await bcrypt.hash(payload.password, 12);
          delete payload.password;
          return payload;
        },
        afterUpdate: async (record, _context, transaction, payload) => {
          if (
            Object.hasOwn(payload, "password_hash") ||
            payload.is_active === false
          ) {
            await Session.update(
              { revoked_at: new Date() },
              {
                where: { account_id: record.id, revoked_at: null },
                transaction,
              },
            );
          }
        },
      },
    });
  }

  async setRoles(accountExternalId, roleExternalIds, context) {
    if (!Array.isArray(roleExternalIds) || roleExternalIds.length === 0) {
      throw new AppError(
        "role_external_ids debe contener al menos un rol",
        422,
        "VALIDATION_ERROR",
      );
    }
    return this.model.sequelize.transaction(async (transaction) => {
      const account = await this.findRecord(accountExternalId, context, {
        transaction,
        include: [],
      });
      const roles = await Role.findAll({
        where: {
          external_id: roleExternalIds,
          tenant_id: context.auth.tenantId,
          is_active: true,
        },
        transaction,
      });
      if (roles.length !== new Set(roleExternalIds).size) {
        throw new AppError(
          "Uno o más roles no existen en el tenant",
          422,
          "INVALID_ROLES",
        );
      }
      if (!context.auth.roles?.has("TENANT_OWNER")) {
        const currentRoles = await account.getRoles({ transaction });
        if (
          [...currentRoles, ...roles].some(
            (role) => role.code === "TENANT_OWNER",
          )
        ) {
          throw new AppError(
            "Solo un propietario puede administrar asignaciones de propietario",
            403,
            "ROLE_REQUIRED",
          );
        }
      }
      await account.setRoles(roles, { transaction });
      await recordAudit({
        context,
        action: "ASSIGN",
        resource: "account_roles",
        resourceId: accountExternalId,
        statusCode: 200,
        details: { role_count: roles.length },
        transaction,
      });
      return this.serialize(account);
    });
  }
}

module.exports = new AccountService();
