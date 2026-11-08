module.exports = (sequelize, DataTypes) => {
  const ProjectWidgetSensor = sequelize.define("ProjectWidgetSensor", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
    widget_id: { type: DataTypes.INTEGER, allowNull: false },
    sensor_id: { type: DataTypes.INTEGER, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
  }, { schema: "iot", tableName: "project_widget_sensors", timestamps: false });
  ProjectWidgetSensor.associate = (models) => {
    ProjectWidgetSensor.belongsTo(models.ProjectWidget, { foreignKey: "widget_id", as: "widget" });
    ProjectWidgetSensor.belongsTo(models.Sensor, { foreignKey: "sensor_id", as: "sensor" });
  };
  return ProjectWidgetSensor;
};
