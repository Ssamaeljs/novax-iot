module.exports = (sequelize, D) => {
  const Message = sequelize.define("IntegrationMessage", {
    id: { type: D.INTEGER, primaryKey: true, autoIncrement: true }, external_id: { type: D.UUID, defaultValue: D.UUIDV4, allowNull: false, unique: true },
    tenant_id: { type: D.INTEGER, allowNull: false }, source_id: { type: D.INTEGER, allowNull: false }, device_id: { type: D.INTEGER, allowNull: false }, profile_id: { type: D.INTEGER, allowNull: false },
    message_id: { type: D.UUID, allowNull: false }, payload_hash: { type: D.STRING(64), allowNull: false }, received_at: { type: D.DATE, allowNull: false }, reading_count: { type: D.INTEGER, allowNull: false }, normalized: { type: D.JSONB, allowNull: false },
  }, { schema: "iot", tableName: "integration_messages", timestamps: false });
  Message.associate = (models) => {
    Message.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Message.belongsTo(models.IntegrationSource, { foreignKey: "source_id", as: "source" });
  };
  return Message;
};
