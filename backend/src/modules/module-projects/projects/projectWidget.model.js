module.exports = (sequelize, DataTypes) => {
  const ProjectWidget = sequelize.define("ProjectWidget", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(120), allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    x: { type: DataTypes.INTEGER, allowNull: false },
    y: { type: DataTypes.INTEGER, allowNull: false },
    width: { type: DataTypes.INTEGER, allowNull: false },
    height: { type: DataTypes.INTEGER, allowNull: false },
    locked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }, { schema: "iot", tableName: "project_widgets", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true });
  ProjectWidget.associate = (models) => {
    ProjectWidget.belongsTo(models.Project, { foreignKey: "project_id", as: "project" });
    ProjectWidget.belongsToMany(models.Sensor, { through: models.ProjectWidgetSensor, foreignKey: "widget_id", otherKey: "sensor_id", as: "sensors" });
  };
  return ProjectWidget;
};
