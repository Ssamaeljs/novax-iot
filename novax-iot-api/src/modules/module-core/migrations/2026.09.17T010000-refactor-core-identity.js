module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query("CREATE SCHEMA IF NOT EXISTS iam", { transaction });
      await queryInterface.sequelize.query("CREATE SCHEMA IF NOT EXISTS iot", { transaction });

      await queryInterface.createTable(
        { tableName: "tenants", schema: "core" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          external_id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal("gen_random_uuid()"), unique: true },
          name: { type: Sequelize.STRING(120), allowNull: false },
          slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
          timezone: { type: Sequelize.STRING(64), allowNull: false, defaultValue: "UTC" },
          metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );

      await queryInterface.addColumn(
        { tableName: "users", schema: "core" },
        "tenant_id",
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction },
      );

      const [userCountRows] = await queryInterface.sequelize.query(
        "SELECT COUNT(*)::int AS count FROM core.users",
        { transaction },
      );
      if (userCountRows[0].count > 0) {
        const [tenantRows] = await queryInterface.sequelize.query(
          `INSERT INTO core.tenants (external_id, name, slug, timezone, metadata, is_active, created_at, updated_at)
           VALUES (gen_random_uuid(), 'Legacy tenant', 'legacy', 'UTC', '{}'::jsonb, true, NOW(), NOW())
           RETURNING id`,
          { transaction },
        );
        await queryInterface.sequelize.query(
          "UPDATE core.users SET tenant_id = :tenantId WHERE tenant_id IS NULL",
          { replacements: { tenantId: tenantRows[0].id }, transaction },
        );
      }

      await queryInterface.changeColumn(
        { tableName: "users", schema: "core" },
        "tenant_id",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        "UPDATE core.users SET last_name = '' WHERE last_name IS NULL",
        { transaction },
      );
      await queryInterface.changeColumn(
        { tableName: "users", schema: "core" },
        "last_name",
        { type: Sequelize.STRING, allowNull: false },
        { transaction },
      );
      await queryInterface.changeColumn(
        { tableName: "users", schema: "core" },
        "is_active",
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction },
      );
      await queryInterface.removeColumn(
        { tableName: "users", schema: "core" },
        "role",
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "users", schema: "core" },
        ["tenant_id", "is_active"],
        { name: "users_tenant_active_idx", transaction },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE core.accounts DROP CONSTRAINT IF EXISTS accounts_pkey;
         ALTER TABLE core.accounts RENAME COLUMN id TO external_id;
         ALTER TABLE core.accounts ADD COLUMN id SERIAL;
         ALTER TABLE core.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);
         ALTER TABLE core.accounts ALTER COLUMN external_id SET DEFAULT gen_random_uuid();
         ALTER TABLE core.accounts ALTER COLUMN external_id SET NOT NULL;`,
        { transaction },
      );
      await queryInterface.renameColumn(
        { tableName: "accounts", schema: "core" },
        "password",
        "password_hash",
        { transaction },
      );
      await queryInterface.addColumn(
        { tableName: "accounts", schema: "core" },
        "tenant_id",
        { type: Sequelize.INTEGER, allowNull: true },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE core.accounts a
         SET tenant_id = u.tenant_id
         FROM core.users u
         WHERE a.user_id = u.id AND a.tenant_id IS NULL`,
        { transaction },
      );
      await queryInterface.changeColumn(
        { tableName: "accounts", schema: "core" },
        "tenant_id",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        { transaction },
      );
      await queryInterface.changeColumn(
        { tableName: "accounts", schema: "core" },
        "is_active",
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE core.accounts DROP CONSTRAINT IF EXISTS accounts_username_key;
         ALTER TABLE core.accounts DROP CONSTRAINT IF EXISTS accounts_email_key;`,
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "accounts", schema: "core" },
        ["external_id"],
        { unique: true, name: "accounts_external_id_uq", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "accounts", schema: "core" },
        ["tenant_id", "username"],
        { unique: true, name: "accounts_tenant_username_uq", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "accounts", schema: "core" },
        ["tenant_id", "email"],
        { unique: true, name: "accounts_tenant_email_uq", transaction },
      );
      await queryInterface.addIndex(
        { tableName: "accounts", schema: "core" },
        ["user_id"],
        { unique: true, name: "accounts_user_id_uq", transaction },
      );
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex({ tableName: "accounts", schema: "core" }, "accounts_user_id_uq", { transaction });
      await queryInterface.removeIndex({ tableName: "accounts", schema: "core" }, "accounts_tenant_email_uq", { transaction });
      await queryInterface.removeIndex({ tableName: "accounts", schema: "core" }, "accounts_tenant_username_uq", { transaction });
      await queryInterface.removeIndex({ tableName: "accounts", schema: "core" }, "accounts_external_id_uq", { transaction });
      await queryInterface.removeColumn({ tableName: "accounts", schema: "core" }, "tenant_id", { transaction });
      await queryInterface.renameColumn({ tableName: "accounts", schema: "core" }, "password_hash", "password", { transaction });
      await queryInterface.sequelize.query(
        `ALTER TABLE core.accounts DROP CONSTRAINT IF EXISTS accounts_pkey;
         ALTER TABLE core.accounts DROP COLUMN id;
         ALTER TABLE core.accounts RENAME COLUMN external_id TO id;
         ALTER TABLE core.accounts ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);`,
        { transaction },
      );
      await queryInterface.removeIndex({ tableName: "users", schema: "core" }, "users_tenant_active_idx", { transaction });
      await queryInterface.addColumn(
        { tableName: "users", schema: "core" },
        "role",
        { type: Sequelize.ENUM("ADMIN", "CUSTOMER"), defaultValue: "CUSTOMER" },
        { transaction },
      );
      await queryInterface.removeColumn({ tableName: "users", schema: "core" }, "tenant_id", { transaction });
      await queryInterface.dropTable({ tableName: "tenants", schema: "core" }, { transaction });
      await queryInterface.sequelize.query("DROP SCHEMA IF EXISTS iam CASCADE", { transaction });
      await queryInterface.sequelize.query("DROP SCHEMA IF EXISTS iot CASCADE", { transaction });
    });
  },
};

