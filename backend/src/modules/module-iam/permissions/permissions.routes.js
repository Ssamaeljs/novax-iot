const permissionController = require("./permissions.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: permissionController,
  permissions: { read: "permissions.read", manage: "permissions.manage" },
  methods: { create: false, update: false, delete: false },
});

