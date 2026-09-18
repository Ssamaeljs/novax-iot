const PUBLIC_ID_TABLES = [
  { schema: "iam", tableName: "permissions", indexName: "permissions_external_id_uq" },
  { schema: "iam", tableName: "role_permissions", indexName: "role_permissions_external_id_uq" },
  { schema: "iam", tableName: "account_roles", indexName: "account_roles_external_id_uq" },
  { schema: "iot", tableName: "measurements", indexName: "measurements_external_id_uq" },
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of PUBLIC_ID_TABLES) {
        await queryInterface.addColumn(
          { tableName: table.tableName, schema: table.schema },
          "external_id",
          {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
          },
          { transaction },
        );
        await queryInterface.addIndex(
          { tableName: table.tableName, schema: table.schema },
          ["external_id"],
          { unique: true, name: table.indexName, transaction },
        );
      }

      await queryInterface.addColumn(
        { tableName: "accounts", schema: "core" },
        "failed_login_attempts",
        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        { transaction },
      );
      await queryInterface.addColumn(
        { tableName: "accounts", schema: "core" },
        "locked_until",
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        { tableName: "accounts", schema: "core" },
        "last_login_at",
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );

      await queryInterface.createTable(
        { tableName: "sessions", schema: "iam" },
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
            onDelete: "CASCADE",
          },
          account_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "accounts", schema: "core" }, key: "id" },
            onDelete: "CASCADE",
          },
          token_prefix: { type: Sequelize.STRING(40), allowNull: false },
          token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          last_used_at: { type: Sequelize.DATE, allowNull: true },
          revoked_at: { type: Sequelize.DATE, allowNull: true },
          ip_address: { type: Sequelize.INET, allowNull: true },
          user_agent: { type: Sequelize.STRING(500), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "sessions", schema: "iam" },
        ["tenant_id", "account_id", "expires_at"],
        { name: "sessions_tenant_account_expiry_idx", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "sessions", schema: "iam" },
        ["token_prefix"],
        { name: "sessions_token_prefix_idx", transaction },
      );

      await queryInterface.addColumn(
        { tableName: "audit_logs", schema: "audit" },
        "session_id",
        {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: { tableName: "sessions", schema: "iam" }, key: "id" },
          onDelete: "SET NULL",
        },
        { transaction },
      );
      await queryInterface.addColumn(
        { tableName: "audit_logs", schema: "audit" },
        "session_external_id",
        { type: Sequelize.UUID, allowNull: true },
        { transaction },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn(
        { tableName: "audit_logs", schema: "audit" },
        "session_external_id",
        { transaction },
      );
      await queryInterface.removeColumn(
        { tableName: "audit_logs", schema: "audit" },
        "session_id",
        { transaction },
      );
      await queryInterface.dropTable({ tableName: "sessions", schema: "iam" }, { transaction });

      await queryInterface.removeColumn(
        { tableName: "accounts", schema: "core" },
        "last_login_at",
        { transaction },
      );
      await queryInterface.removeColumn(
        { tableName: "accounts", schema: "core" },
        "locked_until",
        { transaction },
      );
      await queryInterface.removeColumn(
        { tableName: "accounts", schema: "core" },
        "failed_login_attempts",
        { transaction },
      );

      for (const table of [...PUBLIC_ID_TABLES].reverse()) {
        await queryInterface.removeColumn(
          { tableName: table.tableName, schema: table.schema },
          "external_id",
          { transaction },
        );
      }
    });
  },
};
