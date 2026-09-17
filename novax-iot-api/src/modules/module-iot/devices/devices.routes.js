const deviceController = require("./devices.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: deviceController,
  permissions: { read: "devices.read", manage: "devices.manage" },
});

