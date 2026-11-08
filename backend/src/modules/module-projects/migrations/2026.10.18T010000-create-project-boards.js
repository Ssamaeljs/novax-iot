const permissions = [
  ["projects.read", "Consultar proyectos", "read"],
  ["projects.manage", "Administrar proyectos y tableros", "manage"],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const identity = () => ({
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        external_id: { type: Sequelize.UUID, allowNull: false, unique: true, defaultValue: Sequelize.literal("gen_random_uuid()") },
      });
      const tenant = () => ({ type: Sequelize.INTEGER, allowNull: false, references: { model: { schema: "core", tableName: "tenants" }, key: "id" }, onDelete: "RESTRICT" });
      const timestamps = () => ({ created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") } });
      await queryInterface.createTable({ schema: "iot", tableName: "projects" }, {
        ...identity(), tenant_id: tenant(), code: { type: Sequelize.STRING(80), allowNull: false },
        title: { type: Sequelize.STRING(120), allowNull: false }, description: { type: Sequelize.TEXT },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true }, ...timestamps(),
      }, { transaction });
      await queryInterface.addIndex({ schema: "iot", tableName: "projects" }, ["tenant_id", "code"], { unique: true, name: "projects_tenant_code_uq", transaction });
      await queryInterface.createTable({ schema: "iot", tableName: "project_widgets" }, {
        ...identity(), tenant_id: tenant(),
        project_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: { schema: "iot", tableName: "projects" }, key: "id" }, onDelete: "CASCADE" },
        title: { type: Sequelize.STRING(120), allowNull: false }, type: { type: Sequelize.STRING(20), allowNull: false },
        x: { type: Sequelize.INTEGER, allowNull: false }, y: { type: Sequelize.INTEGER, allowNull: false },
        width: { type: Sequelize.INTEGER, allowNull: false }, height: { type: Sequelize.INTEGER, allowNull: false },
        locked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        settings: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} }, ...timestamps(),
      }, { transaction });
      await queryInterface.addIndex({ schema: "iot", tableName: "project_widgets" }, ["project_id"], { transaction });
      await queryInterface.sequelize.query(`ALTER TABLE iot.project_widgets ADD CONSTRAINT project_widget_layout_ck CHECK (x >= 0 AND y >= 0 AND y <= 200 AND width BETWEEN 3 AND 12 AND height BETWEEN 3 AND 16 AND x + width <= 12)`, { transaction });
      await queryInterface.createTable({ schema: "iot", tableName: "project_widget_sensors" }, {
        ...identity(),
        widget_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: { schema: "iot", tableName: "project_widgets" }, key: "id" }, onDelete: "CASCADE" },
        sensor_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: { schema: "iot", tableName: "sensors" }, key: "id" }, onDelete: "RESTRICT" },
        position: { type: Sequelize.INTEGER, allowNull: false },
      }, { transaction });
      await queryInterface.addIndex({ schema: "iot", tableName: "project_widget_sensors" }, ["widget_id", "sensor_id"], { unique: true, transaction });
      for (const [key, name, action] of permissions) {
        await queryInterface.bulkInsert({ schema: "iam", tableName: "permissions" }, [{ key, name, resource: "projects", action, is_active: true, created_at: new Date(), updated_at: new Date() }], { transaction });
      }
      await queryInterface.sequelize.query(`INSERT INTO iam.role_permissions (role_id, permission_id, created_at, updated_at)
        SELECT r.id, p.id, NOW(), NOW() FROM iam.roles r CROSS JOIN iam.permissions p
        WHERE r.code = 'TENANT_OWNER' AND r.is_system = true AND p.key IN ('projects.read','projects.manage')
        ON CONFLICT (role_id, permission_id) DO NOTHING`, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable({ schema: "iot", tableName: "project_widget_sensors" }, { transaction });
      await queryInterface.dropTable({ schema: "iot", tableName: "project_widgets" }, { transaction });
      await queryInterface.dropTable({ schema: "iot", tableName: "projects" }, { transaction });
      await queryInterface.sequelize.query(`DELETE FROM iam.role_permissions WHERE permission_id IN (SELECT id FROM iam.permissions WHERE key IN ('projects.read','projects.manage'));
        DELETE FROM iam.permissions WHERE key IN ('projects.read','projects.manage')`, { transaction });
    });
  },
};
