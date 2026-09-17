const express = require("express");
const { requirePermission } = require("../../middleware/authorization");

function createAutoCrudRouter({ controller, permissions, methods = {} }) {
  const router = express.Router();
  const enabled = {
    list: methods.list !== false,
    get: methods.get !== false,
    create: methods.create !== false,
    update: methods.update !== false,
    delete: methods.delete !== false,
  };

  if (enabled.list) router.get("/", requirePermission(permissions.read), controller.list);
  if (enabled.get) router.get("/:id", requirePermission(permissions.read), controller.get);
  if (enabled.create) router.post("/", requirePermission(permissions.manage), controller.create);
  if (enabled.update) router.patch("/:id", requirePermission(permissions.manage), controller.update);
  if (enabled.delete) router.delete("/:id", requirePermission(permissions.manage), controller.delete);

  return router;
}

module.exports = createAutoCrudRouter;

