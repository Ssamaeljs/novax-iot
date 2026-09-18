module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define(
    "Session",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      account_id: { type: DataTypes.INTEGER, allowNull: false },
      token_prefix: { type: DataTypes.STRING(40), allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      last_used_at: { type: DataTypes.DATE, allowNull: true },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      ip_address: { type: DataTypes.INET, allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      tableName: "sessions",
      schema: "iam",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    },
  );

  Session.associate = (models) => {
    Session.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Session.belongsTo(models.Account, { foreignKey: "account_id", as: "account" });
    Session.hasMany(models.AuditLog, { foreignKey: "session_id", as: "audit_logs" });
  };

  return Session;
};
