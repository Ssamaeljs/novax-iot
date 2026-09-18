const test = require("node:test");
const assert = require("node:assert/strict");
const AutoCrudService = require("../src/helpers/autoCrud/AutoCrudService");

test("la serialización nunca expone ids internos ni hashes", () => {
  const service = new AutoCrudService({
    model: {
      rawAttributes: {},
      getTableName: () => "examples",
    },
  });

  const result = service.serialize({
    toJSON: () => ({
      id: 10,
      external_id: "public-root-id",
      tenant_id: 2,
      device_id: 3,
      password_hash: "hidden-password-hash",
      nested: {
        id: 20,
        external_id: "public-nested-id",
        account_id: 4,
        token_hash: "hidden-token-hash",
      },
      metadata: { id: "domain-value-kept" },
    }),
  });

  assert.deepEqual(result, {
    external_id: "public-root-id",
    nested: { external_id: "public-nested-id" },
    metadata: { id: "domain-value-kept" },
  });
});

test("AutoCrud rechaza identificadores internos o UUID inválidos", async () => {
  const service = new AutoCrudService({
    model: {
      rawAttributes: {},
      getTableName: () => "examples",
      findOne: async () => {
        throw new Error("database query should not run");
      },
    },
  });

  await assert.rejects(
    () => service.get("123"),
    (error) => error.code === "INVALID_EXTERNAL_ID" && error.status === 422,
  );
});
