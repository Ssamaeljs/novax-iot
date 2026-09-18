const { AutoCrudController } = require("../../../helpers/autoCrud");
const apiTokenService = require("./apiTokens.service");

module.exports = new AutoCrudController(apiTokenService);

