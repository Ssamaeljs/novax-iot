const { AutoCrudController } = require("../../../helpers/autoCrud");
const userService = require("./users.service");

module.exports = new AutoCrudController(userService);
