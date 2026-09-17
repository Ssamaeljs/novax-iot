module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        { tableName: "devices", schema: "iot" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          external_id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal("gen_random_uuid()"), unique: true },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
            onDelete: "CASCADE",
          },
          code: { type: Sequelize.STRING(80), allowNull: false },
          name: { type: Sequelize.STRING(120), allowNull: false },
          device_type: { type: Sequelize.STRING(60), allowNull: false },
          protocol: { type: Sequelize.STRING(40), allowNull: false },
          manufacturer: { type: Sequelize.STRING(100), allowNull: true },
          model: { type: Sequelize.STRING(100), allowNull: true },
          serial_number: { type: Sequelize.STRING(120), allowNull: true },
          firmware_version: { type: Sequelize.STRING(60), allowNull: true },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "OFFLINE" },
          last_seen_at: { type: Sequelize.DATE, allowNull: true },
          metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "devices", schema: "iot" },
        ["tenant_id", "code"],
        { unique: true, name: "devices_tenant_code_uq", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "devices", schema: "iot" },
        ["tenant_id", "status"],
        { name: "devices_tenant_status_idx", transaction },
      );

      await queryInterface.createTable(
        { tableName: "sensors", schema: "iot" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          external_id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal("gen_random_uuid()"), unique: true },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
            onDelete: "CASCADE",
          },
          device_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "devices", schema: "iot" }, key: "id" },
            onDelete: "CASCADE",
          },
          key: { type: Sequelize.STRING(80), allowNull: false },
          name: { type: Sequelize.STRING(120), allowNull: false },
          metric: { type: Sequelize.STRING(100), allowNull: false },
          unit: { type: Sequelize.STRING(30), allowNull: true },
          data_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "NUMBER" },
          minimum_value: { type: Sequelize.DECIMAL, allowNull: true },
          maximum_value: { type: Sequelize.DECIMAL, allowNull: true },
          sampling_interval_seconds: { type: Sequelize.INTEGER, allowNull: true },
          calibration: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "sensors", schema: "iot" },
        ["device_id", "key"],
        { unique: true, name: "sensors_device_key_uq", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "sensors", schema: "iot" },
        ["tenant_id", "metric"],
        { name: "sensors_tenant_metric_idx", transaction },
      );

      await queryInterface.createTable(
        { tableName: "measurements", schema: "iot" },
        {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
            onDelete: "CASCADE",
          },
          device_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "devices", schema: "iot" }, key: "id" },
            onDelete: "CASCADE",
          },
          sensor_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "sensors", schema: "iot" }, key: "id" },
            onDelete: "CASCADE",
          },
          observed_at: { type: Sequelize.DATE, allowNull: false },
          received_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          value_number: { type: Sequelize.DOUBLE, allowNull: true },
          value_text: { type: Sequelize.TEXT, allowNull: true },
          value_boolean: { type: Sequelize.BOOLEAN, allowNull: true },
          value_json: { type: Sequelize.JSONB, allowNull: true },
          quality: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "GOOD" },
          sequence: { type: Sequelize.STRING(80), allowNull: true },
          source_payload: { type: Sequelize.JSONB, allowNull: true },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE iot.measurements
         ADD CONSTRAINT measurements_one_value_ck
         CHECK (num_nonnulls(value_number, value_text, value_boolean, value_json) = 1)`,
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "measurements", schema: "iot" },
        ["tenant_id", "sensor_id", "observed_at"],
        { name: "measurements_tenant_sensor_time_idx", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "measurements", schema: "iot" },
        ["tenant_id", "device_id", "observed_at"],
        { name: "measurements_tenant_device_time_idx", transaction },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable({ tableName: "measurements", schema: "iot" }, { transaction });
      await queryInterface.dropTable({ tableName: "sensors", schema: "iot" }, { transaction });
      await queryInterface.dropTable({ tableName: "devices", schema: "iot" }, { transaction });
    });
  },
};
