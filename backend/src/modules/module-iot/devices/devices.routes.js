const deviceController = require("./devices.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

const router = createAutoCrudRouter({
  controller: deviceController,
  permissions: { read: "devices.read", manage: "devices.manage" },
});

router.use("/:device_external_id/sensors", require("./deviceSensors.routes"));
module.exports = router;

