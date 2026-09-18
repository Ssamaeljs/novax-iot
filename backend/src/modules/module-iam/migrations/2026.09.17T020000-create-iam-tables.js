const PERMISSIONS = [
  ["tenants.read", "Consultar tenant", "tenants", "read"],
  ["tenants.manage", "Administrar tenant", "tenants", "manage"],
  ["users.read", "Consultar usuarios", "users", "read"],
  ["users.manage", "Administrar usuarios", "users", "manage"],
  ["accounts.read", "Consultar cuentas", "accounts", "read"],
  ["accounts.manage", "Administrar cuentas", "accounts", "manage"],
  ["permissions.read", "Consultar permisos", "permissions", "read"],
  ["permissions.manage", "Administrar permisos", "permissions", "manage"],
  ["roles.read", "Consultar roles", "roles", "read"],
  ["roles.manage", "Administrar roles", "roles", "manage"],
  ["api_tokens.read", "Consultar tokens de API", "api_tokens", "read"],
  ["api_tokens.manage", "Administrar tokens de API", "api_tokens", "manage"],
  ["devices.read", "Consultar dispositivos", "devices", "read"],
  ["devices.manage", "Administrar dispositivos", "devices", "manage"],
  ["sensors.read", "Consultar sensores", "sensors", "read"],
  ["sensors.manage", "Administrar sensores", "sensors", "manage"],
  ["measurements.read", "Consultar mediciones", "measurements", "read"],
  ["measurements.write", "Registrar mediciones", "measurements", "write"],
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        { tableName: "permissions", schema: "iam" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          key: { type: Sequelize.STRING(100), allowNull: false, unique: true },
          name: { type: Sequelize.STRING(120), allowNull: false },
          description: { type: Sequelize.STRING(255), allowNull: true },
          resource: { type: Sequelize.STRING(60), allowNull: false },
          action: { type: Sequelize.STRING(40), allowNull: false },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );

      await queryInterface.createTable(
        { tableName: "roles", schema: "iam" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          external_id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal("gen_random_uuid()"), unique: true },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: { tableName: "tenants", schema: "core" }, key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          code: { type: Sequelize.STRING(60), allowNull: false },
          name: { type: Sequelize.STRING(120), allowNull: false },
          description: { type: Sequelize.STRING(255), allowNull: true },
          is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "roles", schema: "iam" },
        ["tenant_id", "code"],
        { unique: true, name: "roles_tenant_code_uq", transaction },
      );

      await queryInterface.createTable(
        { tableName: "role_permissions", schema: "iam" },
        {
          role_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            references: { model: { tableName: "roles", schema: "iam" }, key: "id" },
            onDelete: "CASCADE",
          },
          permission_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            references: { model: { tableName: "permissions", schema: "iam" }, key: "id" },
            onDelete: "CASCADE",
          },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );

      await queryInterface.createTable(
        { tableName: "account_roles", schema: "iam" },
        {
          account_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            references: { model: { tableName: "accounts", schema: "core" }, key: "id" },
            onDelete: "CASCADE",
          },
          role_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            references: { model: { tableName: "roles", schema: "iam" }, key: "id" },
            onDelete: "CASCADE",
          },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );

      await queryInterface.createTable(
        { tableName: "api_tokens", schema: "iam" },
        {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          external_id: { type: Sequelize.UUID, allowNull: false, defaultValue: Sequelize.literal("gen_random_uuid()"), unique: true },
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
          name: { type: Sequelize.STRING(120), allowNull: false },
          token_prefix: { type: Sequelize.STRING(32), allowNull: false },
          token_hash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
          scopes: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
          expires_at: { type: Sequelize.DATE, allowNull: true },
          last_used_at: { type: Sequelize.DATE, allowNull: true },
          revoked_at: { type: Sequelize.DATE, allowNull: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
          updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "api_tokens", schema: "iam" },
        ["tenant_id", "account_id"],
        { name: "api_tokens_tenant_account_idx", transaction },
      );

      await queryInterface.bulkInsert(
        { tableName: "permissions", schema: "iam" },
        PERMISSIONS.map(([key, name, resource, action]) => ({
          key,
          name,
          resource,
          action,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        })),
        { transaction },
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable({ tableName: "api_tokens", schema: "iam" }, { transaction });
      await queryInterface.dropTable({ tableName: "account_roles", schema: "iam" }, { transaction });
      await queryInterface.dropTable({ tableName: "role_permissions", schema: "iam" }, { transaction });
      await queryInterface.dropTable({ tableName: "roles", schema: "iam" }, { transaction });
      await queryInterface.dropTable({ tableName: "permissions", schema: "iam" }, { transaction });
    });
  },
};

