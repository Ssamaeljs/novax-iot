module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define(
    "Tenant",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      slug: { type: DataTypes.STRING(80), allowNull: false, unique: true },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "UTC" },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "tenants",
      schema: "core",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  Tenant.associate = (models) => {
    Tenant.hasMany(models.User, { foreignKey: "tenant_id", as: "users" });
    Tenant.hasMany(models.Role, { foreignKey: "tenant_id", as: "roles" });
    Tenant.hasMany(models.Device, { foreignKey: "tenant_id", as: "devices" });
  };

  return Tenant;
};
