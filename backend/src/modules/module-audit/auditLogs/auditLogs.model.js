module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define(
    "AuditLog",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      actor_account_id: { type: DataTypes.INTEGER, allowNull: true },
      actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
      api_token_id: { type: DataTypes.INTEGER, allowNull: true },
      session_id: { type: DataTypes.BIGINT, allowNull: true },
      actor_account_external_id: { type: DataTypes.UUID, allowNull: true },
      actor_user_external_id: { type: DataTypes.UUID, allowNull: true },
      api_token_external_id: { type: DataTypes.UUID, allowNull: true },
      session_external_id: { type: DataTypes.UUID, allowNull: true },
      action: { type: DataTypes.STRING(40), allowNull: false },
      resource: { type: DataTypes.STRING(100), allowNull: false },
      resource_external_id: { type: DataTypes.STRING(160), allowNull: true },
      outcome: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "SUCCESS" },
      status_code: { type: DataTypes.SMALLINT, allowNull: false },
      request_id: { type: DataTypes.STRING(100), allowNull: true },
      http_method: { type: DataTypes.STRING(10), allowNull: true },
      path: { type: DataTypes.STRING(500), allowNull: true },
      ip_address: { type: DataTypes.INET, allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
      details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: "audit_logs",
      schema: "audit",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
      underscored: true,
    },
  );

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    AuditLog.belongsTo(models.Account, { foreignKey: "actor_account_id", as: "actor_account" });
    AuditLog.belongsTo(models.User, { foreignKey: "actor_user_id", as: "actor_user" });
    AuditLog.belongsTo(models.ApiToken, { foreignKey: "api_token_id", as: "api_token" });
    AuditLog.belongsTo(models.Session, { foreignKey: "session_id", as: "session" });
  };

  return AuditLog;
};
