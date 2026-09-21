const table = { schema: "iam", tableName: "password_resets" };
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        table,
        {
          id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
          external_id: {
            type: Sequelize.UUID,
            allowNull: false,
            unique: true,
            defaultValue: Sequelize.literal("gen_random_uuid()"),
          },
          tenant_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: { schema: "core", tableName: "tenants" },
              key: "id",
            },
            onDelete: "CASCADE",
          },
          account_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: { schema: "core", tableName: "accounts" },
              key: "id",
            },
            onDelete: "CASCADE",
          },
          token_hash: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          expires_at: { type: Sequelize.DATE, allowNull: false },
          used_at: { type: Sequelize.DATE, allowNull: true },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn("NOW"),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.fn("NOW"),
          },
        },
        { transaction },
      );
      await queryInterface.addIndex(table, ["account_id", "created_at"], {
        transaction,
        name: "password_resets_account_created_idx",
      });
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable(table);
  },
};
