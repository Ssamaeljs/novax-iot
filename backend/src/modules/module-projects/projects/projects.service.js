const { Project } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const title = { type: "string", minLength: 2, maxLength: 120 };
const description = { type: "string", maxLength: 4000, allowNull: true };
module.exports = new AutoCrudService({
  model: Project,
  automaticCodePrefix: "PRJ",
  writableFields: ["code", "title", "description", "is_active"],
  filterableFields: ["is_active"], searchableFields: ["code", "title", "description"],
  sortableFields: ["title", "code", "created_at"],
  schemas: {
    create: { title: { ...title, required: true }, description, is_active: { type: "boolean" } },
    update: { title, description, is_active: { type: "boolean" } },
  },
});
