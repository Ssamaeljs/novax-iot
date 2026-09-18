module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query("CREATE SCHEMA IF NOT EXISTS audit", { transaction });

      await queryInterface.createTable(
        { tableName: "audit_logs", schema: "audit" },
        {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
          external_id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
            unique: true,
          },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          actor_account_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: { tableName: "accounts", schema: "core" }, key: "id" },
            onDelete: "SET NULL",
          },
          actor_user_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: { tableName: "users", schema: "core" }, key: "id" },
            onDelete: "SET NULL",
          },
          api_token_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: { model: { tableName: "api_tokens", schema: "iam" }, key: "id" },
            onDelete: "SET NULL",
          },
          actor_account_external_id: { type: Sequelize.UUID, allowNull: true },
          actor_user_external_id: { type: Sequelize.UUID, allowNull: true },
          api_token_external_id: { type: Sequelize.UUID, allowNull: true },
          action: { type: Sequelize.STRING(40), allowNull: false },
          resource: { type: Sequelize.STRING(100), allowNull: false },
          resource_id: { type: Sequelize.STRING(160), allowNull: true },
          outcome: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "SUCCESS" },
          status_code: { type: Sequelize.SMALLINT, allowNull: false },
          request_id: { type: Sequelize.STRING(100), allowNull: true },
          http_method: { type: Sequelize.STRING(10), allowNull: true },
          path: { type: Sequelize.STRING(500), allowNull: true },
          ip_address: { type: Sequelize.INET, allowNull: true },
          user_agent: { type: Sequelize.STRING(500), allowNull: true },
          details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );

      await queryInterface.addIndex(
        { tableName: "audit_logs", schema: "audit" },
        ["tenant_id", "created_at"],
        { name: "audit_logs_tenant_time_idx", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "audit_logs", schema: "audit" },
        ["tenant_id", "actor_account_external_id", "created_at"],
        { name: "audit_logs_tenant_actor_time_idx", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "audit_logs", schema: "audit" },
        ["tenant_id", "resource", "resource_id"],
        { name: "audit_logs_tenant_resource_idx", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "audit_logs", schema: "audit" },
        ["tenant_id", "action", "created_at"],
        { name: "audit_logs_tenant_action_time_idx", transaction },
      );

      await queryInterface.sequelize.query(
        `CREATE OR REPLACE FUNCTION audit.prevent_audit_log_mutation()
         RETURNS trigger AS $$
         BEGIN
           RAISE EXCEPTION 'audit logs are immutable';
         END;
         $$ LANGUAGE plpgsql`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE TRIGGER audit_logs_immutable
         BEFORE UPDATE OR DELETE ON audit.audit_logs
         FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_log_mutation()`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `INSERT INTO iam.permissions
           (key, name, description, resource, action, is_active, created_at, updated_at)
         VALUES
           ('audit_logs.read', 'Consultar auditoría', 'Consultar el historial inmutable de actividad', 'audit_logs', 'read', true, NOW(), NOW())
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           resource = EXCLUDED.resource,
           action = EXCLUDED.action,
           is_active = true,
           updated_at = NOW()`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `INSERT INTO iam.role_permissions (role_id, permission_id, created_at, updated_at)
         SELECT roles.id, permissions.id, NOW(), NOW()
         FROM iam.roles AS roles
         CROSS JOIN iam.permissions AS permissions
         WHERE roles.code = 'TENANT_OWNER'
           AND roles.is_system = true
           AND permissions.key = 'audit_logs.read'
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        { transaction },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DELETE FROM iam.role_permissions
         WHERE permission_id IN (SELECT id FROM iam.permissions WHERE key = 'audit_logs.read')`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        "DELETE FROM iam.permissions WHERE key = 'audit_logs.read'",
        { transaction },
      );
      await queryInterface.dropTable({ tableName: "audit_logs", schema: "audit" }, { transaction });
      await queryInterface.sequelize.query("DROP FUNCTION IF EXISTS audit.prevent_audit_log_mutation()", {
        transaction,
      });
      await queryInterface.sequelize.query("DROP SCHEMA IF EXISTS audit", { transaction });
    });
  },
};
