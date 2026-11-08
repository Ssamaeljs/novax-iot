const AppError = require("../utils/handleError/AppError");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The deployment selects the organization. Requests cannot select another one.
function organizationScope() {
  const externalId = process.env.NOVAX_TENANT_EXTERNAL_ID?.trim();
  if (externalId) {
    if (!UUID.test(externalId)) {
      throw new AppError("Configuración de NOVAX no válida", 503, "ORGANIZATION_NOT_CONFIGURED");
    }
    return { external_id: externalId, is_active: true };
  }
  const slug = process.env.NOVAX_TENANT_SLUG?.trim() || "novax-iot";
  if (slug.length > 80 || !SLUG.test(slug)) {
    throw new AppError("Configuración de NOVAX no válida", 503, "ORGANIZATION_NOT_CONFIGURED");
  }
  return { slug, is_active: true };
}

async function resolveOrganization(options = {}) {
  const { Tenant } = require("./models");
  const organization = await Tenant.findOne({
    where: organizationScope(),
    transaction: options.transaction,
  });
  if (!organization) {
    throw new AppError("La organización NOVAX no está disponible", 503, "ORGANIZATION_NOT_CONFIGURED");
  }
  return organization;
}

// Compatibility for existing API clients: an optional slug must match NOVAX.
function assertOrganizationSlug(slug, organization) {
  if (slug !== undefined && slug !== organization.slug) {
    throw new AppError("Credenciales inválidas", 401, "INVALID_CREDENTIALS");
  }
}

module.exports = { organizationScope, resolveOrganization, assertOrganizationSlug };
