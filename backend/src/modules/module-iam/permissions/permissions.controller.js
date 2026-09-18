const { AutoCrudController } = require("../../../helpers/autoCrud");
const permissionService = require("./permissions.service");

module.exports = new AutoCrudController(permissionService);

