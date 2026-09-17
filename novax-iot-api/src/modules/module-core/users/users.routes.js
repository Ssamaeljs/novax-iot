const userController = require("./users.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: userController,
  permissions: { read: "users.read", manage: "users.manage" },
});
