const { Role, Permission } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const AppError = require("../../../utils/handleError/AppError");

class RoleService extends AutoCrudService {
  constructor() {
    super({
      model: Role,
      writableFields: ["code", "name", "description", "is_active"],
      hiddenFields: ["id", "tenant_id"],
      filterableFields: ["is_active", "is_system"],
      searchableFields: ["code", "name", "description"],
      sortableFields: ["code", "name", "created_at"],
      include: [
        {
          model: Permission,
          as: "permissions",
          attributes: ["key", "name", "resource", "action"],
          through: { attributes: [] },
        },
      ],
      schemas: {
        create: {
          code: { required: true, type: "string", uppercase: true, minLength: 2, maxLength: 60 },
          name: { required: true, type: "string", minLength: 2, maxLength: 120 },
          description: { type: "string", maxLength: 255, allowNull: true },
          is_active: { type: "boolean" },
        },
        update: {
          code: { type: "string", uppercase: true, minLength: 2, maxLength: 60 },
          name: { type: "string", minLength: 2, maxLength: 120 },
          description: { type: "string", maxLength: 255, allowNull: true },
          is_active: { type: "boolean" },
        },
      },
      hooks: {
        beforeUpdate: (record) => {
          if (record.is_system) {
            throw new AppError("Los roles del sistema no se pueden modificar", 409, "SYSTEM_ROLE_IMMUTABLE");
          }
        },
        beforeDelete: (record) => {
          if (record.is_system) {
            throw new AppError("Los roles del sistema no se pueden eliminar", 409, "SYSTEM_ROLE_IMMUTABLE");
          }
        },
      },
    });
  }

  async setPermissions(roleExternalId, permissionKeys, context) {
    if (!Array.isArray(permissionKeys)) {
      throw new AppError("permission_keys debe ser un arreglo", 422, "VALIDATION_ERROR");
    }
    return this.model.sequelize.transaction(async (transaction) => {
      const role = await this.findRecord(roleExternalId, context, { transaction, include: [] });
      if (role.is_system) {
        throw new AppError("Los permisos de un rol del sistema no se pueden modificar", 409, "SYSTEM_ROLE_IMMUTABLE");
      }
      const uniqueKeys = [...new Set(permissionKeys)];
      const permissions = await Permission.findAll({
        where: { key: uniqueKeys, is_active: true },
        transaction,
      });
      if (permissions.length !== uniqueKeys.length) {
        throw new AppError("Uno o más permisos no existen", 422, "INVALID_PERMISSIONS");
      }
      await role.setPermissions(permissions, { transaction });
      const refreshed = await this.findRecord(roleExternalId, context, { transaction });
      return this.serialize(refreshed);
    });
  }
}

module.exports = new RoleService();

