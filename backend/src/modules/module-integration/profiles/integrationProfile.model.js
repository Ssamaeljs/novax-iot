module.exports = (sequelize, D) => {
  const Profile = sequelize.define("IntegrationProfile", {
    id: { type: D.INTEGER, primaryKey: true, autoIncrement: true }, external_id: { type: D.UUID, defaultValue: D.UUIDV4, allowNull: false, unique: true },
    tenant_id: { type: D.INTEGER, allowNull: false }, code: { type: D.STRING(60), allowNull: false }, name: { type: D.STRING(120), allowNull: false },
    description: { type: D.TEXT }, version: { type: D.INTEGER, allowNull: false, defaultValue: 1 }, mappings: { type: D.JSONB, allowNull: false }, is_active: { type: D.BOOLEAN, defaultValue: true, allowNull: false },
  }, { schema: "iot", tableName: "integration_profiles", createdAt: "created_at", updatedAt: "updated_at" });
  Profile.associate = (models) => Profile.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
  return Profile;
};
