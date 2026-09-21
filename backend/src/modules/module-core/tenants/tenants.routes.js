const tenantController = require("./tenants.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");
const { requireRole } = require("../../../middleware/authorization");
const router = require("express").Router();
router.use((req, res, next) =>
  ["GET", "HEAD"].includes(req.method)
    ? next()
    : requireRole("TENANT_OWNER")(req, res, next),
);

router.use(
  createAutoCrudRouter({
    controller: tenantController,
    permissions: { read: "tenants.read", manage: "tenants.manage" },
    methods: { create: false, delete: false },
  }),
);
module.exports = router;
