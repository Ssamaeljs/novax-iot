const { Permission } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");

module.exports = new AutoCrudService({
  model: Permission,
  publicId: "key",
  writableFields: [],
  hiddenFields: ["id"],
  filterableFields: ["resource", "action", "is_active"],
  searchableFields: ["key", "name", "description"],
  sortableFields: ["key", "resource", "action", "created_at"],
  softDeleteField: null,
});

