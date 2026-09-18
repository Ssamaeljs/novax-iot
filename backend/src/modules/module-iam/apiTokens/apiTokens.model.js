module.exports = (sequelize, DataTypes) => {
  const ApiToken = sequelize.define(
    "ApiToken",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      account_id: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      token_prefix: { type: DataTypes.STRING(32), allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      scopes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      expires_at: { type: DataTypes.DATE, allowNull: true },
      last_used_at: { type: DataTypes.DATE, allowNull: true },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "api_tokens",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        { fields: ["tenant_id", "account_id"] },
        { fields: ["token_prefix"] },
      ],
    },
  );

  ApiToken.associate = (models) => {
    ApiToken.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    ApiToken.belongsTo(models.Account, { foreignKey: "account_id", as: "account" });
  };

  return ApiToken;
};
