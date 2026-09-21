const { Tenant } = require("../../../config/models");
const { AutoCrudService } = require("../../../helpers/autoCrud");
const timezoneRule = {
  type: "string",
  maxLength: 64,
  validate(value) {
    try {
      new Intl.DateTimeFormat("es", { timeZone: value });
      return true;
    } catch {
      return "Zona horaria IANA no válida";
    }
  },
};

module.exports = new AutoCrudService({
  model: Tenant,
  writableFields: ["name", "slug", "timezone", "metadata", "is_active"],
  filterableFields: ["is_active", "slug"],
  searchableFields: ["name", "slug"],
  sortableFields: ["name", "slug", "created_at"],
  scope: (context) =>
    context.auth?.tenantId ? { id: context.auth.tenantId } : {},
  schemas: {
    create: {
      name: { required: true, type: "string", minLength: 2, maxLength: 120 },
      slug: {
        required: true,
        type: "string",
        lowercase: true,
        format: "slug",
        maxLength: 80,
      },
      timezone: timezoneRule,
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
    update: {
      name: { type: "string", minLength: 2, maxLength: 120 },
      slug: { type: "string", lowercase: true, format: "slug", maxLength: 80 },
      timezone: timezoneRule,
      metadata: { type: "object" },
      is_active: { type: "boolean" },
    },
  },
});
