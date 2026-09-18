module.exports = (sequelize, DataTypes) => {
  const AccountRole = sequelize.define(
    "AccountRole",
    {
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      account_id: { type: DataTypes.INTEGER, primaryKey: true },
      role_id: { type: DataTypes.INTEGER, primaryKey: true },
    },
    {
      tableName: "account_roles",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  return AccountRole;
};
