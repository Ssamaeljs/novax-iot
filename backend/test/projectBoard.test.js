const test = require("node:test");
const assert = require("node:assert/strict");
const { validateBoard, assertLockedLayout, overlaps } = require("../src/modules/module-projects/projects/board.validation");
const sensor = "11111111-1111-4111-8111-111111111111";
const widget = () => ({ title: "Temperatura", type: "GAUGE", layout: { x: 0, y: 0, width: 4, height: 5, locked: false }, sensor_external_ids: [sensor], settings: {} });
const board = () => ({ version: 0, widgets: [widget()] });

test("validates an empty board and normalizes a numeric scale without mutating the input", () => {
  assert.deepEqual(validateBoard({ version: 0, widgets: [] }), { version: 0, widgets: [] });
  const input = board();
  assert.deepEqual(validateBoard(input).widgets[0].settings, { min: 0, max: 100 });
  assert.deepEqual(input.widgets[0].settings, {});
});
test("rejects internal identifiers, unknown fields and duplicate widget identities", () => {
  assert.throws(() => validateBoard({ ...board(), tenant_id: 1 }), { code: "INVALID_BOARD" });
  const input = board(); input.widgets[0].id = 1;
  assert.throws(() => validateBoard(input), { code: "INVALID_BOARD" });
  const first = { ...widget(), external_id: sensor };
  assert.throws(() => validateBoard({ version: 0, widgets: [first, { ...first, layout: { ...first.layout, x: 4 } }] }), { code: "INVALID_BOARD" });
});
test("rejects out-of-bounds, non-integer and overlapping widget layouts", () => {
  for (const change of [{ x: -1 }, { x: 10 }, { width: 13 }, { height: 2 }, { y: 201 }, { y: 1.5 }, { locked: "false" }]) {
    const input = board(); Object.assign(input.widgets[0].layout, change);
    assert.throws(() => validateBoard(input), { code: "INVALID_BOARD" });
  }
  assert.throws(() => validateBoard({ version: 0, widgets: [widget(), widget()] }), { code: "WIDGET_OVERLAP" });
  assert.equal(overlaps({ x: 0, y: 0, width: 4, height: 5 }, { x: 4, y: 0, width: 4, height: 5 }), false);
});
test("requires a public sensor identity and limits numeric indicators to one sensor", () => {
  for (const ids of [[], ["123"], [sensor, sensor], [sensor, "22222222-2222-4222-8222-222222222222"]]) {
    const input = board(); input.widgets[0].sensor_external_ids = ids;
    assert.throws(() => validateBoard(input), { code: "INVALID_BOARD" });
  }
});
test("rejects invalid scales, unsupported types and oversized boards", () => {
  for (const settings of [{ min: 10, max: 10 }, { min: 100, max: -10 }, { min: "0" }, { max: Infinity }, null]) {
    const input = board(); input.widgets[0].settings = settings;
    assert.throws(() => validateBoard(input), { code: "INVALID_BOARD" });
  }
  assert.throws(() => validateBoard({ version: -1, widgets: [] }), { code: "INVALID_BOARD" });
  assert.throws(() => validateBoard({ version: 0, widgets: Array.from({ length: 31 }, widget) }), { code: "INVALID_BOARD" });
  const input = board(); input.widgets[0].type = "SCRIPT";
  assert.throws(() => validateBoard(input), { code: "INVALID_BOARD" });
});
test("accepts a static HTML template but rejects scripts, handlers and external resources", () => {
  const input = board(); input.widgets[0].type = "HTML";
  input.widgets[0].settings = { html: '<div class="value">{{value}} {{unit}}</div>', css: '.value{color:var(--primary)}' };
  assert.equal(validateBoard(input).widgets[0].type, "HTML");
  for (const html of ['<script>alert(1)</script>', '<div onclick="alert(1)">Test</div>', '<iframe srcdoc="test"></iframe>', '<img src="https://example.test">', '<a href="https://example.test">Link</a>']) {
    input.widgets[0].settings.html = html;
    assert.throws(() => validateBoard(input), { code: "UNSAFE_WIDGET_CONTENT" });
  }
  input.widgets[0].settings.html = '<p>{{value}}</p>';
  input.widgets[0].settings.css = '@import "https://example.test/style.css";';
  assert.throws(() => validateBoard(input), { code: "UNSAFE_WIDGET_CONTENT" });
});
test("a locked widget must be unlocked before changing its geometry", () => {
  const current = { x: 0, y: 0, width: 4, height: 5, locked: true };
  assert.throws(() => assertLockedLayout(current, { ...current, x: 4 }), { code: "WIDGET_LOCKED", status: 409 });
  assertLockedLayout(current, { ...current });
  assertLockedLayout(current, { ...current, x: 4, locked: false });
});
