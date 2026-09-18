const tenantController = require("./tenants.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: tenantController,
  permissions: { read: "tenants.read", manage: "tenants.manage" },
  methods: { create: false, delete: false },
});

