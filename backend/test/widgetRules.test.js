const test = require("node:test");
const assert = require("node:assert/strict");
const automaticCode = require("../src/utils/automaticCode");
const { validateRules } = require("../src/modules/module-projects/projects/widgetRules.validation");
const { validateBoard } = require("../src/modules/module-projects/projects/board.validation");
const sensor = "11111111-1111-4111-8111-111111111111";
const rule = () => ({ sensor_external_id: sensor, operator: "gte", value: 30, tone: "danger", label: "Temperatura alta" });

test("automatic codes use safe prefixes, full UUID entropy and bounded length", () => {
  for (const prefix of ["DEV", "PRJ", "ROL"]) {
    const codes = Array.from({ length: 1000 }, () => automaticCode(prefix));
    assert.equal(new Set(codes).size, codes.length);
    assert.ok(codes.every((code) => new RegExp(`^${prefix}-[A-F0-9]{32}$`).test(code) && code.length <= 60));
  }
  assert.throws(() => automaticCode("bad prefix"));
});
test("color rules preserve priority, zero/negative thresholds and do not mutate input", () => {
  const rules = [{ ...rule(), value: 0, label: "  Cero  " }, { ...rule(), operator: "between", value: -10, upper: 0 }];
  const normalized = validateRules(rules, [sensor]);
  assert.equal(normalized[0].label, "Cero");
  assert.equal(rules[0].label, "  Cero  ");
  assert.equal(normalized[1].upper, 0);
  assert.equal(validateRules(undefined, []), undefined);
});
test("color rules reject arbitrary CSS, formulas, unbound sensors and invalid thresholds", () => {
  for (const patch of [{ tone: "#ffffff" }, { operator: "eval" }, { value: "30" }, { value: Infinity }, { label: " " }, { sensor_external_id: "other" }, { script: "bad()" }, { operator: "between", upper: 20 }, { upper: 50 }]) {
    assert.throws(() => validateRules([{ ...rule(), ...patch }], [sensor]), { code: "INVALID_WIDGET_RULES" });
  }
  for (const rules of [null, {}, Array.from({ length: 11 }, rule)]) assert.throws(() => validateRules(rules, [sensor]), { code: "INVALID_WIDGET_RULES" });
});
test("all widget types accept rules inside their validated settings", () => {
  for (const type of ["GAUGE", "THERMOMETER", "TIMELINE", "HTML"]) {
    const result = validateBoard({ version: 0, widgets: [{ title: type, type, layout: { x: 0, y: 0, width: 4, height: 5, locked: false }, sensor_external_ids: [sensor], settings: { ...(type === "HTML" ? { html: "<p>{{value}}</p>" } : {}), color_rules: [rule()] } }] });
    assert.equal(result.widgets[0].settings.color_rules[0].tone, "danger");
  }
});
