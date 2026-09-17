module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    "Permission",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      resource: { type: DataTypes.STRING(60), allowNull: false },
      action: { type: DataTypes.STRING(40), allowNull: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "permissions",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  Permission.associate = (models) => {
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: "permission_id",
      otherKey: "role_id",
      as: "roles",
    });
  };

  return Permission;
};
