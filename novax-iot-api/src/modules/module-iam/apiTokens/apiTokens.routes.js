const apiTokenController = require("./apiTokens.controller");
const { createAutoCrudRouter } = require("../../../helpers/autoCrud");

module.exports = createAutoCrudRouter({
  controller: apiTokenController,
  permissions: { read: "api_tokens.read", manage: "api_tokens.manage" },
});
