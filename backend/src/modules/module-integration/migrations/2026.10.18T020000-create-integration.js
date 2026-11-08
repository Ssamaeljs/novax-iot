module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      const identity = () => ({ id: { type: S.INTEGER, primaryKey: true, autoIncrement: true }, external_id: { type: S.UUID, allowNull: false, unique: true, defaultValue: S.literal("gen_random_uuid()") } });
      const ref = (table, schema = "iot") => ({ type: S.INTEGER, allowNull: false, references: { model: { schema, tableName: table }, key: "id" }, onDelete: "RESTRICT" });
      const times = () => ({ created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") }, updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn("NOW") } });
      await q.createTable({ schema: "iot", tableName: "integration_profiles" }, {
        ...identity(), tenant_id: ref("tenants", "core"), code: { type: S.STRING(60), allowNull: false }, name: { type: S.STRING(120), allowNull: false }, description: { type: S.TEXT },
        version: { type: S.INTEGER, allowNull: false, defaultValue: 1 }, mappings: { type: S.JSONB, allowNull: false }, is_active: { type: S.BOOLEAN, allowNull: false, defaultValue: true }, ...times(),
      }, opts);
      await q.addIndex({ schema: "iot", tableName: "integration_profiles" }, ["tenant_id", "code", "version"], { ...opts, unique: true });
      await q.createTable({ schema: "iot", tableName: "integration_sources" }, {
        ...identity(), tenant_id: ref("tenants", "core"), device_id: ref("devices"), profile_id: ref("integration_profiles"),
        name: { type: S.STRING(120), allowNull: false }, transport: { type: S.STRING(10), allowNull: false }, token_hash: { type: S.STRING(64), allowNull: false, unique: true },
        token_prefix: { type: S.STRING(32), allowNull: false }, heartbeat_timeout_seconds: { type: S.INTEGER, allowNull: false, defaultValue: 300 },
        last_received_at: { type: S.DATE }, is_active: { type: S.BOOLEAN, allowNull: false, defaultValue: true }, ...times(),
      }, opts);
      await q.addIndex({ schema: "iot", tableName: "integration_sources" }, ["device_id"], opts);
      await q.createTable({ schema: "iot", tableName: "integration_messages" }, {
        ...identity(), tenant_id: ref("tenants", "core"), source_id: ref("integration_sources"), device_id: ref("devices"), profile_id: ref("integration_profiles"),
        message_id: { type: S.UUID, allowNull: false }, payload_hash: { type: S.STRING(64), allowNull: false }, received_at: { type: S.DATE, allowNull: false },
        reading_count: { type: S.INTEGER, allowNull: false }, normalized: { type: S.JSONB, allowNull: false },
      }, opts);
      await q.addIndex({ schema: "iot", tableName: "integration_messages" }, ["source_id", "message_id"], { ...opts, unique: true });
      await q.addColumn({ schema: "iot", tableName: "measurements" }, "integration_message_id", { ...ref("integration_messages"), allowNull: true }, opts);
      await q.addColumn({ schema: "iot", tableName: "measurements" }, "metric_snapshot", { type: S.STRING(100), allowNull: true }, opts);
      await q.addColumn({ schema: "iot", tableName: "measurements" }, "unit_snapshot", { type: S.STRING(30), allowNull: true }, opts);
      await q.sequelize.query(`ALTER TABLE iot.integration_profiles ADD CONSTRAINT integration_version_ck CHECK (version > 0);
        ALTER TABLE iot.integration_sources ADD CONSTRAINT integration_transport_ck CHECK (transport IN ('HTTPS','MQTT'));
        ALTER TABLE iot.integration_sources ADD CONSTRAINT integration_timeout_ck CHECK (heartbeat_timeout_seconds BETWEEN 30 AND 86400)`, opts);
      for (const [key, action, name] of [["integrations.read", "read", "Consultar integraciones"], ["integrations.manage", "manage", "Administrar modelo común e integraciones"]]) {
        await q.bulkInsert({ schema: "iam", tableName: "permissions" }, [{ key, action, name, resource: "integrations", is_active: true, created_at: new Date(), updated_at: new Date() }], opts);
      }
      await q.sequelize.query(`INSERT INTO iam.role_permissions (role_id, permission_id, created_at, updated_at)
        SELECT r.id,p.id,NOW(),NOW() FROM iam.roles r CROSS JOIN iam.permissions p
        WHERE r.is_system=true AND r.code='TENANT_OWNER' AND p.key IN ('integrations.read','integrations.manage')
        ON CONFLICT (role_id,permission_id) DO NOTHING`, opts);
    });
  },
  async down(q) {
    await q.sequelize.transaction(async (transaction) => {
      const opts = { transaction };
      for (const column of ["integration_message_id", "metric_snapshot", "unit_snapshot"]) await q.removeColumn({ schema: "iot", tableName: "measurements" }, column, opts);
      for (const tableName of ["integration_messages", "integration_sources", "integration_profiles"]) await q.dropTable({ schema: "iot", tableName }, opts);
      await q.sequelize.query(`DELETE FROM iam.role_permissions WHERE permission_id IN (SELECT id FROM iam.permissions WHERE resource='integrations'); DELETE FROM iam.permissions WHERE resource='integrations'`, opts);
    });
  },
};
