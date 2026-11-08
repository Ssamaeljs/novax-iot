const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");

test("project boards, persistence, telemetry, isolation and permissions", { skip: process.env.RUN_DATABASE_TESTS !== "1", timeout: 60000 }, async (t) => {
  require("dotenv").config({ quiet: true });
  assert.notEqual(process.env.NODE_ENV, "production");
  const app = require("../index");
  const { sequelize, Tenant, User, Account, Role, Permission, Session, Device, Sensor, Measurement, Project, AuditLog } = require("../src/config/models");
  const { generateSessionToken } = require("../src/utils/security/apiToken");
  const originalEnv = { ...process.env };
  const originalQuery = sequelize.query.bind(sequelize);
  const originalTransaction = sequelize.transaction.bind(sequelize);
  const outer = await originalTransaction();
  sequelize.query = (sql, options = {}) => originalQuery(sql, { ...options, transaction: options.transaction || outer });
  sequelize.transaction = (options, callback) => typeof options === "function" ? originalTransaction({ transaction: outer }, options) : originalTransaction({ ...options, transaction: outer }, callback);
  process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/v1/api/`;
  async function request(path, { method = "GET", body, cookie } = {}) {
    const response = await fetch(base + path, { method, headers: { Origin: process.env.WEB_ORIGIN, "Content-Type": "application/json", "X-Novax-CSRF": "1", ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  }
  function publicOnly(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(key !== "id" && !["tenant_id", "project_id", "widget_id", "sensor_id", "device_id", "password_hash", "token_hash"].includes(key), `Internal field: ${key}`);
      publicOnly(child);
    }
  }
  try {
    const tenant = await Tenant.create({ name: "NOVAX project QA", slug: `board-${crypto.randomBytes(6).toString("hex")}`, timezone: "America/Guayaquil" });
    process.env.NOVAX_TENANT_EXTERNAL_ID = tenant.external_id;
    async function identity(username, permissions) {
      const user = await User.create({ tenant_id: tenant.id, first_name: "Board", last_name: "Test", id_card: `QA-${username}` });
      const account = await Account.create({ tenant_id: tenant.id, user_id: user.id, username, email: `${username}@example.test`, password_hash: await bcrypt.hash(crypto.randomBytes(18).toString("hex"), 4) });
      const role = await Role.create({ tenant_id: tenant.id, code: username.toUpperCase(), name: username });
      await role.setPermissions(await Permission.findAll({ where: { key: permissions } }));
      await account.setRoles([role]);
      const token = generateSessionToken();
      await Session.create({ tenant_id: tenant.id, account_id: account.id, token_hash: token.tokenHash, token_prefix: token.tokenPrefix, expires_at: new Date(Date.now() + 60000) });
      return { cookie: `novax_session=${token.token}`, role };
    }
    const owner = await identity("editor", ["projects.read", "projects.manage", "sensors.read", "measurements.read"]);
    const viewer = await identity("viewer", ["projects.read"]);
    const device = await Device.create({ tenant_id: tenant.id, code: "BOARD-ESP", name: "Board device", device_type: "SIMULATOR", protocol: "HTTP" });
    const sensors = [];
    for (let index = 0; index < 2; index++) sensors.push(await Sensor.create({ tenant_id: tenant.id, device_id: device.id, key: `temp-${index}`, name: `Temperature ${index}`, metric: "temperature", unit: "°C", data_type: "NUMBER" }));
    const foreignTenant = await Tenant.create({ name: "Foreign fixture", slug: `foreign-${crypto.randomBytes(6).toString("hex")}` });
    const foreignDevice = await Device.create({ tenant_id: foreignTenant.id, code: "OTHER", name: "Other", device_type: "SIMULATOR", protocol: "HTTP" });
    const foreignSensor = await Sensor.create({ tenant_id: foreignTenant.id, device_id: foreignDevice.id, key: "temp", name: "Other", metric: "temperature", unit: "°C", data_type: "NUMBER" });
    const foreignProject = await Project.create({ tenant_id: foreignTenant.id, code: "FOREIGN", title: "Foreign" });
    let project;
    let board;
    const definition = (type, x, y = 0) => ({ title: type, type, layout: { x, y, width: 4, height: 5, locked: false }, sensor_external_ids: [sensors[0].external_id], settings: type === "HTML" ? { html: '<strong>{{value}} {{unit}}</strong>', css: 'strong{color:var(--primary)}' } : type === "TIMELINE" ? {} : { min: -20, max: 100 } });
    await t.test("creates projects with public identifiers and enforces the project permission", async () => {
      assert.equal((await request("projects", { method: "POST", cookie: viewer.cookie, body: { title: "No", code: "NO" } })).status, 403);
      const created = await request("projects", { method: "POST", cookie: owner.cookie, body: { title: "Secretaría", description: "Sensor dashboard" } });
      assert.equal(created.status, 201); project = created.body.data; publicOnly(created.body);
      assert.match(project.code, /^PRJ-[A-F0-9]{32}$/);
      assert.equal((await request(`projects/${project.external_id}`, { method: "PATCH", cookie: owner.cookie, body: { code: "MANUAL" } })).body.code, "UNKNOWN_FIELDS");
      assert.equal((await request(`projects/${foreignProject.external_id}/board`, { cookie: owner.cookie })).status, 404);
      const listed = await request("projects", { cookie: owner.cookie });
      assert.equal(listed.body.pagination.total, 1);
    });
    await t.test("persists different widgets and many-sensor comparisons without exposing internal IDs", async () => {
      const widgets = [definition("THERMOMETER", 0), definition("GAUGE", 4), definition("TIMELINE", 0, 5), definition("HTML", 4, 5)];
      widgets[2].sensor_external_ids.push(sensors[1].external_id);
      widgets[1].settings.color_rules = [{ sensor_external_id: sensors[0].external_id, operator: "gte", value: 25, tone: "warning", label: "Temperatura alta" }];
      const saved = await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: { version: 0, widgets } });
      assert.equal(saved.status, 200); board = saved.body.data;
      assert.equal(board.version, 1); assert.equal(board.widgets.length, 4); publicOnly(saved.body);
      assert.equal(board.widgets.find((widget) => widget.type === "TIMELINE").sensors.length, 2);
      assert.equal(board.widgets.find((widget) => widget.type === "GAUGE").settings.color_rules[0].tone, "warning");
      const reloaded = await request(`projects/${project.external_id}/board`, { cookie: viewer.cookie });
      assert.deepEqual(reloaded.body.data.widgets, board.widgets);
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: viewer.cookie, body: { version: 1, widgets: [] } })).status, 403);
    });
    const payload = (widgets) => ({ version: board.version, widgets: widgets.map(({ sensors: _sensors, ...widget }) => widget) });
    await t.test("rejects stale saves, unknown sensors, cross-project widgets and unsafe HTML atomically", async () => {
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: { version: 0, widgets: [] } })).body.code, "BOARD_VERSION_CONFLICT");
      const foreign = payload(board.widgets); foreign.widgets[0].sensor_external_ids = [foreignSensor.external_id];
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: foreign })).body.code, "INVALID_WIDGET_SENSORS");
      const missing = payload(board.widgets); missing.widgets[0].external_id = crypto.randomUUID();
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: missing })).body.code, "WIDGET_NOT_FOUND");
      const invalidRule = payload(board.widgets);
      invalidRule.widgets[0] = { ...invalidRule.widgets[0], settings: { color_rules: [{ sensor_external_id: foreignSensor.external_id, operator: "gte", value: 0, tone: "danger", label: "Foreign" }] } };
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: invalidRule })).body.code, "INVALID_WIDGET_RULES");
      const unsafe = payload(board.widgets); unsafe.widgets.find((widget) => widget.type === "HTML").settings = { html: '<script>alert(1)</script>' };
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: unsafe })).body.code, "UNSAFE_WIDGET_CONTENT");
      await sensors[1].update({ unit: "°F" });
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: payload(board.widgets) })).body.code, "INCOMPATIBLE_WIDGET_SENSORS");
      await sensors[1].update({ unit: "°C" });
      const result = await request(`projects/${project.external_id}/board`, { cookie: owner.cookie });
      assert.equal(result.body.data.version, board.version); assert.equal(result.body.data.widgets.length, 4);
    });
    await t.test("keeps locked positions immutable until explicitly unlocked", async () => {
      const locked = payload(board.widgets); locked.widgets[0].layout = { ...locked.widgets[0].layout, locked: true };
      const saved = await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: locked });
      assert.equal(saved.status, 200); board = saved.body.data;
      const moved = payload(board.widgets); moved.widgets[0].layout = { ...moved.widgets[0].layout, y: 10 };
      assert.equal((await request(`projects/${project.external_id}/board`, { method: "PUT", cookie: owner.cookie, body: moved })).body.code, "WIDGET_LOCKED");
    });
    await t.test("returns latest typed readings and ordered comparison samples only with measurements.read", async () => {
      for (const sensor of sensors) for (const [index, value] of [-10, 0, 25].entries()) await Measurement.create({ tenant_id: tenant.id, device_id: device.id, sensor_id: sensor.id, value_number: value, observed_at: new Date(Date.now() - (3 - index) * 60000) });
      assert.equal((await request(`projects/${project.external_id}/telemetry`, { cookie: viewer.cookie })).status, 403);
      const result = await request(`projects/${project.external_id}/telemetry?range=24h`, { cookie: owner.cookie });
      assert.equal(result.status, 200); publicOnly(result.body);
      assert.equal(result.body.data.series.length, 2);
      for (const series of result.body.data.series) { assert.equal(series.latest.value, 25); assert.deepEqual(series.points.map((point) => point.value), [-10, 0, 25]); }
      assert.equal((await request(`projects/${project.external_id}/telemetry?range=__proto__`, { cookie: owner.cookie })).status, 422);
    });
    await t.test("records board mutations and preserves the last state after denied requests", async () => {
      assert.ok(await AuditLog.count({ where: { tenant_id: tenant.id, action: "UPDATE", resource: "project_boards", resource_external_id: project.external_id } }));
      const result = await request(`projects/${project.external_id}/board`, { cookie: owner.cookie });
      assert.equal(result.body.data.widgets[0].layout.locked, true);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    sequelize.query = originalQuery; sequelize.transaction = originalTransaction;
    await outer.rollback(); await sequelize.close();
    for (const key of ["WEB_ORIGIN", "NOVAX_TENANT_EXTERNAL_ID"]) {
      if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
    }
  }
});
