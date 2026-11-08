module.exports = (sequelize, D) => {
  const Source = sequelize.define("IntegrationSource", {
    id: { type: D.INTEGER, primaryKey: true, autoIncrement: true }, external_id: { type: D.UUID, defaultValue: D.UUIDV4, allowNull: false, unique: true },
    tenant_id: { type: D.INTEGER, allowNull: false }, device_id: { type: D.INTEGER, allowNull: false }, profile_id: { type: D.INTEGER, allowNull: false },
    name: { type: D.STRING(120), allowNull: false }, transport: { type: D.STRING(10), allowNull: false }, token_hash: { type: D.STRING(64), allowNull: false }, token_prefix: { type: D.STRING(32), allowNull: false },
    heartbeat_timeout_seconds: { type: D.INTEGER, allowNull: false, defaultValue: 300 }, last_received_at: { type: D.DATE }, is_active: { type: D.BOOLEAN, allowNull: false, defaultValue: true },
  }, { schema: "iot", tableName: "integration_sources", createdAt: "created_at", updatedAt: "updated_at" });
  Source.associate = (models) => {
    Source.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Source.belongsTo(models.Device, { foreignKey: "device_id", as: "device" });
    Source.belongsTo(models.IntegrationProfile, { foreignKey: "profile_id", as: "profile" });
  };
  return Source;
};
