module.exports = (sequelize, DataTypes) => {
  const Device = sequelize.define(
    "Device",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      external_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, allowNull: false, unique: true },
      tenant_id: { type: DataTypes.INTEGER, allowNull: false },
      code: { type: DataTypes.STRING(80), allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      device_type: { type: DataTypes.STRING(60), allowNull: false },
      protocol: { type: DataTypes.STRING(40), allowNull: false },
      manufacturer: { type: DataTypes.STRING(100), allowNull: true },
      model: { type: DataTypes.STRING(100), allowNull: true },
      serial_number: { type: DataTypes.STRING(120), allowNull: true },
      firmware_version: { type: DataTypes.STRING(60), allowNull: true },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "OFFLINE" },
      last_seen_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "devices",
      schema: "iot",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        { unique: true, fields: ["tenant_id", "code"] },
        { fields: ["tenant_id", "status"] },
      ],
    },
  );

  Device.associate = (models) => {
    Device.belongsTo(models.Tenant, { foreignKey: "tenant_id", as: "tenant" });
    Device.hasMany(models.Sensor, { foreignKey: "device_id", as: "sensors" });
    Device.hasMany(models.Measurement, { foreignKey: "device_id", as: "measurements" });
  };

  return Device;
};
