const express = require("express");
const roleController = require("./roles.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");
const { requirePermission } = require("../../../middleware/authorization");

const router = express.Router();
router.put("/:id/permissions", requirePermission("roles.manage"), roleController.setPermissions);
router.use(
  createAutoCrudRouter({
    controller: roleController,
    permissions: { read: "roles.read", manage: "roles.manage" },
  }),
);

module.exports = router;

