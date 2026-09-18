module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.changeColumn(
        { tableName: "users", schema: "core" },
        "external_id",
        {
          type: Sequelize.UUID,
          allowNull: false,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        { transaction },
      );
      await queryInterface.addIndex(
        { tableName: "users", schema: "core" },
        ["tenant_id", "id_card"],
        { unique: true, name: "users_tenant_id_card_uq", transaction },
      );
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex(
        { tableName: "users", schema: "core" },
        "users_tenant_id_card_uq",
        { transaction },
      );
      await queryInterface.changeColumn(
        { tableName: "users", schema: "core" },
        "external_id",
        {
          type: Sequelize.UUID,
          allowNull: true,
          defaultValue: Sequelize.literal("gen_random_uuid()"),
        },
        { transaction },
      );
    });
  },
};
