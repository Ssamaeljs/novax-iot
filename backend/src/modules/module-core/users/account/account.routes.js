const express = require("express");
const accountController = require("./account.controller");
const { createAutoCrudRouter } = require("../../../../helpers/autoCrud");
const { requirePermission } = require("../../../../middleware/authorization");

const router = express.Router();
router.post("/:external_id/roles", requirePermission("roles.manage"), accountController.setRoles);
router.use(
  createAutoCrudRouter({
    controller: accountController,
    permissions: { read: "accounts.read", manage: "accounts.manage" },
  }),
);

module.exports = router;
