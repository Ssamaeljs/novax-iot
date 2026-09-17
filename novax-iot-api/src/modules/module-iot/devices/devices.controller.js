const { AutoCrudController } = require("../../../helpers/autoCrud");
const deviceService = require("./devices.service");

module.exports = new AutoCrudController(deviceService);

