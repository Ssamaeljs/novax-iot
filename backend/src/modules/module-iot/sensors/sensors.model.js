module.exports = (sequelize, DataTypes) => {
  const Sensor = sequelize.define(
    "Sensor",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      device_id: { type: DataTypes.INTEGER, allowNull: false },
      key: { type: DataTypes.STRING(80), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      metric: { type: DataTypes.STRING(100), allowNull: false },
      unit: { type: DataTypes.STRING(30), allowNull: true },
      data_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "NUMBER" },
      minimum_value: { type: DataTypes.DECIMAL, allowNull: true },
      maximum_value: { type: DataTypes.DECIMAL, allowNull: true },
      sampling_interval_seconds: { type: DataTypes.INTEGER, allowNull: true },
      calibration: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "sensors",
      schema: "iot",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        { unique: true, fields: ["device_id", "key"] },
        { fields: ["tenant_id", "metric"] },
      ],
    },
  );

  Sensor.associate = (models) => {
    Sensor.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Sensor.belongsTo(models.Device, { foreignKey: "device_id", as: "device" });
    Sensor.hasMany(models.Measurement, { foreignKey: "sensor_id", as: "measurements" });
  };

  return Sensor;
};
