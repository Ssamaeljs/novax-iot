const express = require("express");
const router = express.Router();
const { authenticateApiToken } = require("../middleware/authentication");

router.use("/bootstrap", require("./bootstrap/bootstrap.routes"));

router.use(authenticateApiToken);

router.use("/core/tenants", require("./module-core/tenants/tenants.routes"));
router.use("/core/users", require("./module-core/users/users.routes"));
router.use("/core/accounts", require("./module-core/users/account/account.routes"));

router.use("/iam/permissions", require("./module-iam/permissions/permissions.routes"));
router.use("/iam/roles", require("./module-iam/roles/roles.routes"));
router.use("/iam/api-tokens", require("./module-iam/apiTokens/apiTokens.routes"));

router.use("/iot/devices", require("./module-iot/devices/devices.routes"));
router.use("/iot/sensors", require("./module-iot/sensors/sensors.routes"));
router.use("/iot/measurements", require("./module-iot/measurements/measurements.routes"));

module.exports = router;
