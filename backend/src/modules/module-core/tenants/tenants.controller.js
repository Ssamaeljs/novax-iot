const { AutoCrudController } = require("../../../helpers/autoCrud");
const tenantService = require("./tenants.service");

module.exports = new AutoCrudController(tenantService);

