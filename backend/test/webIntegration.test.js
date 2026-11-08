const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const bcrypt = require("bcrypt");

// Opt-in integration suite: every fixture/query is enclosed in a rolled-back transaction.
// It never changes existing accounts or sends mail. Use only with the local development DB.
test(
  "NOVAX-only web identity, credential isolation, RBAC, CRUD and password recovery",
  { skip: process.env.RUN_DATABASE_TESTS !== "1", timeout: 60000 },
  async (t) => {
    require("dotenv").config({ quiet: true });
    assert.notEqual(
      process.env.NODE_ENV,
      "production",
      "Database integration tests are forbidden in production",
    );
    const app = require("../index");
    const {
      sequelize,
      Account,
      PasswordReset,
      Session,
      Tenant,
      User,
      Role,
      Permission,
      Device,
      ApiToken,
    } = require("../src/config/models");
    const { hashToken, generateSessionToken, generateApiToken } = require("../src/utils/security/apiToken");
    const mailer = require("../src/modules/module-iam/auth/passwordMailer");
    const originalQuery = sequelize.query.bind(sequelize);
    const originalTransaction = sequelize.transaction.bind(sequelize);
    const originalSend = mailer.sendReset;
    const originalEnv = { ...process.env };
    const outer = await originalTransaction();
    sequelize.query = (sql, options = {}) =>
      originalQuery(sql, {
        ...options,
        transaction: options.transaction || outer,
      });
    sequelize.transaction = (options, callback) =>
      typeof options === "function"
        ? originalTransaction({ transaction: outer }, options)
        : originalTransaction({ ...options, transaction: outer }, callback);
    process.env.PUBLIC_REGISTRATION_ENABLED = "true";
    process.env.WEB_ORIGIN = "http://127.0.0.1:4200";
    process.env.SMTP_HOST = "local-test.invalid";
    process.env.SMTP_FROM = "no-reply@example.test";
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/v1/api/`;
    const password = crypto.randomBytes(24).toString("base64url");
    const slug = `qa-${crypto.randomBytes(6).toString("hex")}`;
    const payload = {
      tenant_name: "Integration QA",
      tenant_slug: slug,
      timezone: "America/Guayaquil",
      first_name: "Test",
      last_name: "Owner",
      id_card: "QA-12345",
      username: "owner",
      email: "owner@example.test",
      password,
    };
    async function request(
      path,
      { method = "GET", body, cookie, csrf = true } = {},
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: process.env.WEB_ORIGIN,
          ...(csrf ? { "X-Novax-CSRF": "1" } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        headers: response.headers,
        body: response.status === 204 ? null : await response.json(),
      };
    }
    function publicOnly(value) {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        assert.ok(
          key !== "id" &&
            ![
              "tenant_id",
              "account_id",
              "user_id",
              "sensor_id",
              "device_id",
              "password_hash",
              "token_hash",
            ].includes(key),
          `Internal field exposed: ${key}`,
        );
        publicOnly(child);
      }
    }
    let cookie;
    let tenant;
    let device;
    let sensor;
    let readonlyCookie;
    try {
      async function fixtureOrganization(tenantSlug) {
        const organization = await Tenant.create({ name: "NOVAX integration QA", slug: tenantSlug, timezone: "America/Guayaquil" });
        const user = await User.create({ tenant_id: organization.id, first_name: "Test", last_name: "Owner", id_card: "QA-12345" });
        const account = await Account.create({ tenant_id: organization.id, user_id: user.id, username: "owner", email: payload.email, password_hash: await bcrypt.hash(password, 4) });
        const role = await Role.create({ tenant_id: organization.id, code: "TENANT_OWNER", name: "Owner", is_system: true });
        await role.setPermissions(await Permission.findAll({ where: { is_active: true } }));
        await account.setRoles([role]);
        return { organization, account };
      }
      const novax = await fixtureOrganization(slug);
      const other = await fixtureOrganization(`${slug}-other`);
      tenant = novax.organization;
      process.env.NOVAX_TENANT_EXTERNAL_ID = tenant.external_id;
      await t.test(
        "registration remains disabled even if a previous deployment enables its flag",
        async () => {
          process.env.PUBLIC_REGISTRATION_ENABLED = "false";
          assert.equal(
            (await request("auth/register", { method: "POST", body: payload }))
              .status,
            403,
          );
          process.env.PUBLIC_REGISTRATION_ENABLED = "true";
          assert.equal(
            (
              await request("auth/register", {
                method: "POST",
                body: { ...payload, role: "ADMIN" },
              })
            ).status,
            403,
          );
          const registered = await request("auth/register", {
            method: "POST",
            body: payload,
          });
          assert.equal(registered.status, 403);
          assert.equal((await request("auth/capabilities")).body.data.registration_enabled, false);
          assert.equal(await Tenant.count(), 2);
        },
      );
      await t.test(
        "web login sets an HttpOnly cookie without exposing the session secret",
        async () => {
          const login = await request("auth/web/login", {
            method: "POST",
            body: { identifier: payload.username, password },
          });
          assert.equal(login.status, 201);
          publicOnly(login.body);
          assert.equal(login.body.data.session.token, undefined);
          const header = login.headers.get("set-cookie");
          assert.match(header, /HttpOnly/);
          assert.match(header, /SameSite=Lax/);
          assert.match(header, /Path=\/v1\/api/);
          cookie = header.split(";")[0];
          assert.equal((await request("auth/me", { cookie })).status, 200);
          assert.equal(
            (
              await request("auth/logout", {
                method: "POST",
                cookie,
                csrf: false,
              })
            ).status,
            403,
          );
        },
      );
      await t.test(
        "device/sensor/measurement contracts, pagination and tenant isolation",
        async () => {
          const created = await request("iot/devices", {
            method: "POST",
            cookie,
            body: {
              name: "Secretaría",
              device_type: "ESP32",
              protocol: "MQTT",
              status: "ONLINE",
            },
          });
          assert.equal(created.status, 201);
          device = created.body.data;
          assert.match(device.code, /^DEV-[A-F0-9]{32}$/);
          assert.equal((await request(`iot/devices/${device.external_id}`, { method: "PATCH", cookie, body: { code: "MANUAL" } })).body.code, "UNKNOWN_FIELDS");
          const createdSensor = await request("iot/sensors", {
            method: "POST",
            cookie,
            body: {
              device_external_id: device.external_id,
              key: "humidity",
              name: "Humedad",
              metric: "humidity",
              unit: "%",
              data_type: "NUMBER",
              minimum_value: 0,
              maximum_value: 100,
            },
          });
          assert.equal(createdSensor.status, 201);
          sensor = createdSensor.body.data;
          assert.equal(
            (
              await request("iot/measurements", {
                method: "POST",
                cookie,
                body: {
                  sensor_external_id: sensor.external_id,
                  observed_at: new Date().toISOString(),
                  value: 54.5,
                },
              })
            ).status,
            201,
          );
          const readings = await request(
            `iot/measurements?sensor_external_id=${sensor.external_id}`,
            { cookie },
          );
          assert.equal(readings.status, 200);
          assert.equal(readings.body.data[0].value, 54.5);
          publicOnly(readings.body);
          const list = await request("iot/devices?is_active=true&page_size=1", {
            cookie,
          });
          assert.equal(list.body.pagination.total, 1);
          const otherLogin = await request("auth/web/login", {
            method: "POST",
            body: {
              tenant_slug: `${slug}-other`,
              identifier: "owner",
              password,
            },
          });
          assert.equal(otherLogin.status, 401);
          const oldSession = generateSessionToken();
          await Session.create({ tenant_id: other.organization.id, account_id: other.account.id, token_hash: oldSession.tokenHash, token_prefix: oldSession.tokenPrefix, expires_at: new Date(Date.now() + 60000) });
          const otherCookie = `novax_session=${oldSession.token}`;
          assert.equal(
            (
              await request(`iot/devices/${device.external_id}`, {
                cookie: otherCookie,
              })
            ).status,
            401,
          );
          assert.equal(
            (await request("iot/devices", { cookie: otherCookie })).status,
            401,
          );
          const oldToken = generateApiToken();
          await ApiToken.create({ tenant_id: other.organization.id, account_id: other.account.id, name: "Foreign fixture token", token_hash: oldToken.tokenHash, token_prefix: oldToken.tokenPrefix, scopes: ["devices.read"] });
          const forbidden = await fetch(base + "iot/devices", { headers: { Authorization: `Bearer ${oldToken.token}` } });
          assert.equal(forbidden.status, 401);
          const foreignDevice = await Device.create({ tenant_id: other.organization.id, code: "OTHER", name: "Other fixture", device_type: "SIMULATOR", protocol: "HTTP" });
          assert.equal((await request(`iot/devices/${foreignDevice.external_id}`, { cookie })).status, 404);
          const resetToken = crypto.randomBytes(32).toString("base64url");
          await PasswordReset.create({ tenant_id: other.organization.id, account_id: other.account.id, token_hash: hashToken(resetToken), expires_at: new Date(Date.now() + 60000) });
          assert.equal((await request("auth/reset-password", { method: "POST", body: { token: resetToken, password: "unaccepted-fixture-password" } })).status, 422);
        },
      );
      await t.test(
        "role assignments govern real API permissions and owner-only settings",
        async () => {
          const user = await request("core/users", {
            method: "POST",
            cookie,
            body: {
              first_name: "Read",
              last_name: "Only",
              id_card: "QA-54321",
            },
          });
          const account = await request("core/accounts", {
            method: "POST",
            cookie,
            body: {
              user_external_id: user.body.data.external_id,
              username: "reader",
              email: "reader@example.test",
              password,
            },
          });
          assert.equal(account.status, 201);
          const role = await request("iam/roles", {
            method: "POST",
            cookie,
            body: { name: "Consulta" },
          });
          assert.equal(role.status, 201);
          assert.match(role.body.data.code, /^ROL-[A-F0-9]{32}$/);
          assert.equal((await request(`iam/roles/${role.body.data.external_id}`, { method: "PATCH", cookie, body: { code: "TENANT_OWNER" } })).body.code, "UNKNOWN_FIELDS");
          assert.equal(
            (
              await request(
                `iam/roles/${role.body.data.external_id}/permissions`,
                {
                  method: "PUT",
                  cookie,
                  body: { permission_keys: ["devices.read", "tenants.manage"] },
                },
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                `core/accounts/${account.body.data.external_id}/roles`,
                {
                  method: "POST",
                  cookie,
                  body: { role_external_ids: [role.body.data.external_id] },
                },
              )
            ).status,
            200,
          );
          const login = await request("auth/web/login", {
            method: "POST",
            body: { identifier: "reader", password },
          });
          readonlyCookie = login.headers.get("set-cookie").split(";")[0];
          assert.equal(
            (await request("iot/devices", { cookie: readonlyCookie })).status,
            200,
          );
          assert.equal(
            (
              await request("iot/devices", {
                method: "POST",
                cookie: readonlyCookie,
                body: {},
              })
            ).status,
            403,
          );
          assert.equal(
            (
              await request(`core/tenants/${tenant.external_id}`, {
                method: "PATCH",
                cookie: readonlyCookie,
                body: { name: "Not permitted" },
              })
            ).status,
            403,
          );
        },
      );
      await t.test(
        "self profile updates only own public fields; tokens expose the secret once",
        async () => {
          assert.equal(
            (
              await request("auth/me", {
                method: "PATCH",
                cookie,
                body: { first_name: "QA", last_name: "Owner", tenant_id: 1 },
              })
            ).status,
            422,
          );
          assert.equal(
            (
              await request("auth/me", {
                method: "PATCH",
                cookie,
                body: { first_name: "QA", last_name: "Owner" },
              })
            ).status,
            200,
          );
          const token = await request("iam/api-tokens", {
            method: "POST",
            cookie,
            body: { name: "QA integration", scopes: ["measurements.write"] },
          });
          assert.equal(token.status, 201);
          assert.ok(token.body.data.token);
          const list = await request("iam/api-tokens", { cookie });
          assert.equal(list.body.data[0].token, undefined);
          publicOnly(list.body);
          const audit = await request('audit/logs', { cookie });
          assert.equal(audit.status, 200);
          publicOnly(audit.body);
          assert.ok(audit.body.data.some(event => event.actor_account?.username === 'owner'));
          assert.equal(
            (
              await request(`iam/api-tokens/${token.body.data.external_id}`, {
                method: "DELETE",
                cookie,
              })
            ).status,
            204,
          );
        },
      );
      await t.test(
        "recovery is generic, sends only through the mailer and stores a hash",
        async () => {
          let finish;
          const delivered = new Promise((resolve) => {
            finish = resolve;
          });
          mailer.sendReset = async (_recipient, token) => finish(token);
          const known = await request("auth/forgot-password", {
            method: "POST",
            body: { email: payload.email },
          });
          assert.equal(known.status, 202);
          const raw = await Promise.race([
            delivered,
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Mailer was not invoked")),
                5000,
              ),
            ),
          ]);
          const stored = await PasswordReset.findOne({
            where: { token_hash: hashToken(raw) },
          });
          assert.ok(stored);
          assert.equal(stored.tenant_id, tenant.id);
          assert.notEqual(stored.token_hash, raw);
          const unknown = await request("auth/forgot-password", {
            method: "POST",
            body: { email: "absent@example.test" },
          });
          assert.deepEqual(unknown.body, known.body);
          // Allow the fire-and-forget lookup to finish before releasing the test transaction.
          await new Promise((resolve) => setTimeout(resolve, 100));
          const changed = await request("auth/reset-password", {
            method: "POST",
            body: {
              token: raw,
              password: crypto.randomBytes(24).toString("base64url"),
            },
          });
          assert.equal(changed.status, 200);
          assert.equal((await request("auth/me", { cookie })).status, 401);
          assert.equal(
            (
              await request("auth/reset-password", {
                method: "POST",
                body: { token: raw, password },
              })
            ).status,
            422,
          );
          assert.equal(
            await Session.count({
              where: { account_id: stored.account_id, revoked_at: null },
            }),
            0,
          );
        },
      );
      await t.test(
        "logout revokes the session and expires its cookie",
        async () => {
          const result = await request("auth/logout", {
            method: "POST",
            cookie: readonlyCookie,
          });
          assert.equal(result.status, 204);
          assert.match(
            result.headers.get("set-cookie"),
            /Expires=Thu, 01 Jan 1970/,
          );
          assert.equal(
            (await request("auth/me", { cookie: readonlyCookie })).status,
            401,
          );
        },
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
      sequelize.query = originalQuery;
      sequelize.transaction = originalTransaction;
      mailer.sendReset = originalSend;
      await outer.rollback();
      await sequelize.close();
      for (const name of [
        "PUBLIC_REGISTRATION_ENABLED",
        "WEB_ORIGIN",
        "SMTP_HOST",
        "SMTP_FROM",
        "NOVAX_TENANT_EXTERNAL_ID",
      ]) {
        if (originalEnv[name] === undefined) delete process.env[name];
        else process.env[name] = originalEnv[name];
      }
    }
  },
);
