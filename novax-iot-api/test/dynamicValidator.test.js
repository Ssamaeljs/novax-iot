const test = require("node:test");
const assert = require("node:assert/strict");
const DynamicValidator = require("../src/helpers/autoCrud/DynamicValidator");

test("normaliza campos y valida formatos declarativos", async () => {
  const validator = new DynamicValidator();
  const value = await validator.validate(
    {
      email: { required: true, type: "string", trim: true, lowercase: true, format: "email" },
      code: { required: true, type: "string", trim: true, uppercase: true },
    },
    { email: "  USER@EXAMPLE.COM ", code: " sensor-01 " },
  );

  assert.equal(value.email, "user@example.com");
  assert.equal(value.code, "SENSOR-01");
});

test("devuelve errores estructurados para datos inválidos", async () => {
  const validator = new DynamicValidator();
  await assert.rejects(
    () => validator.validate({ email: { required: true, format: "email" } }, { email: "invalid" }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.status, 422);
      assert.equal(error.details[0].field, "email");
      return true;
    },
  );
});

test("permite actualizaciones parciales", async () => {
  const validator = new DynamicValidator();
  const value = await validator.validate(
    { name: { required: true, type: "string" }, active: { type: "boolean" } },
    { active: false },
    { partial: true },
  );
  assert.deepEqual(value, { active: false });
});

