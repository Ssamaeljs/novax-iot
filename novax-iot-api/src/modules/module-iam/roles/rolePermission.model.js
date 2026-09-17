module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define(
    "RolePermission",
    {
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
