const { User } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");

module.exports = new AutoCrudService({
  model: User,
  writableFields: ["first_name", "last_name", "is_active"],
  filterableFields: ["is_active"],
  searchableFields: ["first_name", "last_name"],
  sortableFields: ["first_name", "last_name", "created_at"],
  schemas: {
    create: {
      first_name: { required: true, type: "string", minLength: 2, maxLength: 120 },
      last_name: { required: true, type: "string", minLength: 1, maxLength: 120 },
      is_active: { type: "boolean" },
    },
    update: {
      first_name: { type: "string", minLength: 2, maxLength: 120 },
      last_name: { type: "string", minLength: 1, maxLength: 120 },
      is_active: { type: "boolean" },
    },
  },
});

