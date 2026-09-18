module.exports = {
  up: async (queryInterface) => {
    await queryInterface.renameColumn(
      { tableName: "audit_logs", schema: "audit" },
      "resource_id",
      "resource_external_id",
    );
  },

  down: async (queryInterface) => {
    await queryInterface.renameColumn(
      { tableName: "audit_logs", schema: "audit" },
      "resource_external_id",
      "resource_id",
    );
  },
};
