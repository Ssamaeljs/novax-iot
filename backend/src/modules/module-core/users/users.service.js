const { User } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");

module.exports = new AutoCrudService({
  model: User,
  writableFields: ["first_name", "last_name", "id_card", "is_active"],
  filterableFields: ["is_active"],
  searchableFields: ["first_name", "last_name", "id_card"],
  sortableFields: ["first_name", "last_name", "created_at"],
  schemas: {
    create: {
      first_name: { required: true, type: "string", minLength: 2, maxLength: 120 },
      last_name: { required: true, type: "string", minLength: 1, maxLength: 120 },
      id_card: {
        required: true,
        type: "string",
        uppercase: true,
        minLength: 5,
        maxLength: 30,
        pattern: /^[A-Z0-9-]+$/,
        patternMessage: "Solo puede contener letras, números y guiones",
      },
      is_active: { type: "boolean" },
    },
    update: {
      first_name: { type: "string", minLength: 2, maxLength: 120 },
      last_name: { type: "string", minLength: 1, maxLength: 120 },
      id_card: {
        type: "string",
        uppercase: true,
        minLength: 5,
        maxLength: 30,
        pattern: /^[A-Z0-9-]+$/,
        patternMessage: "Solo puede contener letras, números y guiones",
      },
      is_active: { type: "boolean" },
    },
  },
});

