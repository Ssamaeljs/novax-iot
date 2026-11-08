const express = require("express");
const router = express.Router();
const { authenticateBearer } = require("../middleware/authentication");

router.use("/bootstrap", require("./bootstrap/bootstrap.routes"));
router.use("/auth", require("./module-iam/auth/auth.routes"));
// Device credentials are independent of browser sessions and IAM API tokens.
router.use("/ingest/https", require("./module-integration/adapters/https.routes"));

router.use(authenticateBearer);

router.use("/core/tenants", require("./module-core/tenants/tenants.routes"));
router.use("/core/users", require("./module-core/users/users.routes"));
router.use("/core/accounts", require("./module-core/users/account/account.routes"));

router.use("/iam/permissions", require("./module-iam/permissions/permissions.routes"));
router.use("/iam/roles", require("./module-iam/roles/roles.routes"));
router.use("/iam/api-tokens", require("./module-iam/apiTokens/apiTokens.routes"));

router.use("/audit/logs", require("./module-audit/auditLogs/auditLogs.routes"));

router.use("/iot/devices", require("./module-iot/devices/devices.routes"));
router.use("/iot/sensors", require("./module-iot/sensors/sensors.routes"));
router.use("/iot/measurements", require("./module-iot/measurements/measurements.routes"));
router.use("/projects", require("./module-projects/projects/projects.routes"));
router.use("/integrations", require("./module-integration/integration.routes"));

module.exports = router;
