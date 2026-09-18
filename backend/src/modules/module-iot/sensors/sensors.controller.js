const { AutoCrudController } = require("../../../helpers/autoCrud");
const sensorService = require("./sensors.service");

module.exports = new AutoCrudController(sensorService);

