module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define("Project", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(80), allowNull: false },
    title: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  }, { schema: "iot", tableName: "projects", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true });
  Project.associate = (models) => {
    Project.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Project.hasMany(models.ProjectWidget, { foreignKey: "project_id", as: "widgets" });
  };
  return Project;
};
