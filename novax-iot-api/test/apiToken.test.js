const test = require("node:test");
const assert = require("node:assert/strict");
const { generateApiToken, hashToken, safeEqual } = require("../src/utils/security/apiToken");

test("genera tokens opacos distintos y almacenable solo como hash", () => {
  const first = generateApiToken();
  const second = generateApiToken();

  assert.match(first.token, /^nvx_live_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]+$/);
  assert.equal(first.tokenHash, hashToken(first.token));
  assert.equal(first.tokenHash.length, 64);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("compara secretos sin comparación temprana", () => {
  assert.equal(safeEqual("a".repeat(32), "a".repeat(32)), true);
  assert.equal(safeEqual("a".repeat(32), "b".repeat(32)), false);
  assert.equal(safeEqual("short", "different-length"), false);
});

