const test = require("node:test");
const assert = require("node:assert/strict");
const { requestAuditContext } = require("../src/modules/module-audit/auditLogs/auditContext");

test("audit context records field names but never request values", () => {
  const headers = {
    "x-forwarded-for": "203.0.113.8, 10.0.0.2",
    "user-agent": "Novax test client",
  };
  const req = {
    body: { username: "admin", password: "do-not-log-this" },
    query: { search: "private-search-value" },
    requestId: "request-123",
    method: "PATCH",
    originalUrl: "/v1/api/core/accounts/id?search=private-search-value",
    ip: "203.0.113.8",
    get: (name) => headers[name.toLowerCase()],
  };

  const result = requestAuditContext(req);
  const serialized = JSON.stringify(result);

  assert.deepEqual(result.bodyFields, ["username", "password"]);
  assert.deepEqual(result.queryFields, ["search"]);
  assert.equal(result.ipAddress, "203.0.113.8");
  assert.equal(result.path, "/v1/api/core/accounts/id");
  assert.equal(serialized.includes("do-not-log-this"), false);
  assert.equal(serialized.includes("private-search-value"), false);
});

test("audit context records only the size of a measurement batch", () => {
  const req = {
    body: { measurements: [{ value: 1 }, { value: 2 }] },
    query: {},
    method: "POST",
    originalUrl: "/v1/api/iot/measurements/bulk",
    socket: { remoteAddress: "::1" },
    get: () => undefined,
  };

  const result = requestAuditContext(req);

  assert.equal(result.batchSize, 2);
  assert.equal(JSON.stringify(result).includes('"value"'), false);
});
