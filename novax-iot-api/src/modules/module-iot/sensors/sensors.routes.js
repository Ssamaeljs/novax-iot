const sensorController = require("./sensors.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: sensorController,
  permissions: { read: "sensors.read", manage: "sensors.manage" },
});

