const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const models = require("../src/config/models");
const { organizationScope, resolveOrganization, assertOrganizationSlug } = require("../src/config/organization");
const access = require("../src/modules/module-iam/auth/accountAccess.service");
const auth = require("../src/modules/module-iam/auth/auth.service");
const { authenticateBearer } = require("../src/middleware/authentication");

const externalId = "11111111-1111-4111-8111-111111111111";
const organization = { id: 7, external_id: externalId, slug: "novax-iot" };

test.beforeEach((t) => {
  const keys = ["NOVAX_TENANT_EXTERNAL_ID", "NOVAX_TENANT_SLUG", "PUBLIC_REGISTRATION_ENABLED", "BOOTSTRAP_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  t.mock.method(models.sequelize, "query", async () => {
    throw new Error("Unexpected database access in an isolated unit test");
  });
});

test("selects NOVAX by default and permits an explicitly configured public identity", () => {
  assert.deepEqual(organizationScope(), { slug: "novax-iot", is_active: true });
  process.env.NOVAX_TENANT_EXTERNAL_ID = externalId;
  assert.deepEqual(organizationScope(), { external_id: externalId, is_active: true });
});

test("rejects invalid organization configuration without falling back to another tenant", () => {
  process.env.NOVAX_TENANT_EXTERNAL_ID = "7";
  assert.throws(() => organizationScope(), { code: "ORGANIZATION_NOT_CONFIGURED" });
  delete process.env.NOVAX_TENANT_EXTERNAL_ID;
  process.env.NOVAX_TENANT_SLUG = "invalid slug";
  assert.throws(() => organizationScope(), { code: "ORGANIZATION_NOT_CONFIGURED" });
});

test("resolves only the configured active organization and fails when it is absent", async (t) => {
  const lookup = t.mock.method(models.Tenant, "findOne", async () => organization);
  assert.equal(await resolveOrganization(), organization);
  assert.deepEqual(lookup.mock.calls[0].arguments[0].where, organizationScope());
  lookup.mock.mockImplementation(async () => null);
  await assert.rejects(() => resolveOrganization(), { code: "ORGANIZATION_NOT_CONFIGURED", status: 503 });
});

test("accepts an omitted or matching legacy slug and refuses another organization", () => {
  assertOrganizationSlug(undefined, organization);
  assertOrganizationSlug("novax-iot", organization);
  assert.throws(() => assertOrganizationSlug("other-company", organization), { code: "INVALID_CREDENTIALS" });
});

test("public registration stays closed even when the previous feature flag is enabled", async (t) => {
  process.env.PUBLIC_REGISTRATION_ENABLED = "true";
  const create = t.mock.method(models.Tenant, "create", async () => {
    throw new Error("Registration must not create an organization");
  });
  assert.equal(access.capabilities().registration_enabled, false);
  await assert.rejects(() => access.register({ tenant_slug: "other-company" }), { code: "REGISTRATION_DISABLED", status: 403 });
  assert.equal(create.mock.callCount(), 0);
});

test("login without a tenant uses NOVAX and searches accounts only within its context", async (t) => {
  t.mock.method(models.Tenant, "findOne", async () => organization);
  const lookup = t.mock.method(models.Account, "findOne", async () => null);
  t.mock.method(bcrypt, "compare", async () => false);
  await assert.rejects(() => auth.login({ identifier: "person", password: "unit-test-only" }), { code: "INVALID_CREDENTIALS" });
  assert.equal(lookup.mock.calls[0].arguments[0].where.tenant_id, organization.id);
});

test("a request cannot switch login to another organization", async (t) => {
  t.mock.method(models.Tenant, "findOne", async () => organization);
  const lookup = t.mock.method(models.Account, "findOne", async () => null);
  await assert.rejects(() => auth.login({ tenant_slug: "other-company", identifier: "person", password: "unit-test-only" }), { code: "INVALID_CREDENTIALS" });
  assert.equal(lookup.mock.callCount(), 0);
});

for (const [name, model, token] of [
  ["session", models.Session, "nvx_session_unit-test"],
  ["API token", models.ApiToken, "nvx_live_unit-test"],
]) {
  test(`${name} authentication restricts existing credentials to the configured organization`, async (t) => {
    process.env.NOVAX_TENANT_EXTERNAL_ID = externalId;
    const lookup = t.mock.method(model, "findOne", async () => null);
    const response = {
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await authenticateBearer({ method: "GET", get: (header) => header === "authorization" ? `Bearer ${token}` : undefined }, response, () => assert.fail("Invalid credentials must not advance"));
    const tenantJoin = lookup.mock.calls[0].arguments[0].include.find((include) => include.as === "tenant");
    assert.deepEqual(tenantJoin.where, { external_id: externalId, is_active: true });
    assert.equal(response.statusCode, 401);
  });
}

test("organization settings cannot change the identity or deactivate the deployment", async (t) => {
  const service = require("../src/modules/module-core/tenants/tenants.service");
  t.mock.method(models.Tenant, "findOne", async () => organization);
  const context = { transaction: {}, auth: { tenantId: organization.id } };
  for (const input of [{ slug: "other-company" }, { is_active: false }]) {
    await assert.rejects(() => service.update(externalId, input, context), { code: "UNKNOWN_FIELDS" });
  }
});

test("bootstrap cannot add another organization when one already exists", async (t) => {
  process.env.BOOTSTRAP_SECRET = "unit-test-secret-".repeat(3);
  t.mock.method(models.sequelize, "transaction", async (callback) => callback({}));
  t.mock.method(models.sequelize, "query", async () => []);
  t.mock.method(models.ApiToken, "count", async () => 0);
  t.mock.method(models.Tenant, "count", async () => 1);
  const create = t.mock.method(models.Tenant, "create", async () => assert.fail("Existing data must not be changed"));
  const bootstrap = require("../src/modules/bootstrap/bootstrap.service");
  await assert.rejects(() => bootstrap.execute({
    first_name: "Test", last_name: "Owner", id_card: "QA-12345", username: "owner",
    email: "owner@example.test", password: "unit-test-password-only",
  }, process.env.BOOTSTRAP_SECRET), { code: "BOOTSTRAP_ALREADY_COMPLETED" });
  assert.equal(create.mock.callCount(), 0);
});
