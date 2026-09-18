module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `CREATE SCHEMA IF NOT EXISTS core`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DROP SCHEMA IF EXISTS core CASCADE`
    );
  }
};