module.exports = (sequelize, DataTypes) => {
  const Role = sequelize.define(
    "Role",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      code: { type: DataTypes.STRING(60), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "roles",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [{ unique: true, fields: ["tenant_id", "code"] }],
    },
  );

  Role.associate = (models) => {
    Role.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: "role_id",
      otherKey: "permission_id",
      as: "permissions",
    });
    Role.belongsToMany(models.Account, {
      through: models.AccountRole,
      foreignKey: "role_id",
      otherKey: "account_id",
      as: "accounts",
    });
  };

  return Role;
};
