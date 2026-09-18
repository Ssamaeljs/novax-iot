module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    "RolePermission",
    {
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      role_id: { type: DataTypes.INTEGER, primaryKey: true },
      permission_id: { type: DataTypes.INTEGER, primaryKey: true },
    },
    {
      tableName: "role_permissions",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  return RolePermission;
};
