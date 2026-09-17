const express = require("express");
const measurementController = require("./measurements.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");
const { requirePermission } = require("../../../middleware/authorization");

const router = express.Router();
router.post("/bulk", requirePermission("measurements.write"), measurementController.bulkCreate);
router.use(
  createAutoCrudRouter({
    controller: measurementController,
    permissions: { read: "measurements.read", manage: "measurements.write" },
    methods: { update: false, delete: false },
  }),
);

module.exports = router;
