module.exports = (sequelize, DataTypes) => {
  const Measurement = sequelize.define(
    "Measurement",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      device_id: { type: DataTypes.INTEGER, allowNull: false },
      sensor_id: { type: DataTypes.INTEGER, allowNull: false },
      observed_at: { type: DataTypes.DATE, allowNull: false },
      received_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      value_number: { type: DataTypes.DOUBLE, allowNull: true },
      value_text: { type: DataTypes.TEXT, allowNull: true },
      value_boolean: { type: DataTypes.BOOLEAN, allowNull: true },
      value_json: { type: DataTypes.JSONB, allowNull: true },
      quality: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "GOOD" },
      sequence: { type: DataTypes.STRING(80), allowNull: true },
      source_payload: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: "measurements",
      schema: "iot",
      timestamps: false,
      underscored: true,
      indexes: [
        { fields: ["tenant_id", "sensor_id", "observed_at"] },
        { fields: ["tenant_id", "device_id", "observed_at"] },
      ],
    },
  );

  Measurement.associate = (models) => {
    Measurement.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Measurement.belongsTo(models.Device, { foreignKey: "device_id", as: "device" });
    Measurement.belongsTo(models.Sensor, { foreignKey: "sensor_id", as: "sensor" });
  };

  return Measurement;
};
