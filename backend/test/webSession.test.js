const test = require("node:test");
const assert = require("node:assert/strict");
const {
  cookieOptions,
  readSessionCookie,
  assertWebRequest,
} = require("../src/utils/security/webSession");
const req = (headers) => ({ get: (name) => headers[name] });
test("web cookies are HttpOnly, scoped and secure in production", () => {
  const original = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.deepEqual(cookieOptions(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/v1/api",
    });
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
  }
});
test("cookie parser handles unrelated and malformed cookies safely", () => {
  assert.equal(
    readSessionCookie(
      req({ cookie: "other=abc; novax_session=nvx_session_test" }),
    ),
    "nvx_session_test",
  );
  assert.equal(readSessionCookie(req({ cookie: "novax_session=%ZZ" })), null);
  assert.equal(readSessionCookie(req({})), null);
});
test("cookie mutations require both a trusted origin and a non-simple header", () => {
  const origin = process.env.WEB_ORIGIN;
  const env = process.env.NODE_ENV;
  try {
    process.env.WEB_ORIGIN = "https://workspace.example.test";
    process.env.NODE_ENV = "production";
    assert.throws(
      () => assertWebRequest(req({ origin: process.env.WEB_ORIGIN })),
      { code: "CSRF_REJECTED" },
    );
    assert.throws(
      () =>
        assertWebRequest(
          req({ origin: "https://attacker.example.test", "x-novax-csrf": "1" }),
        ),
      { code: "CSRF_REJECTED" },
    );
    assert.doesNotThrow(() =>
      assertWebRequest(
        req({ origin: process.env.WEB_ORIGIN, "x-novax-csrf": "1" }),
      ),
    );
  } finally {
    if (origin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = origin;
    if (env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env;
  }
});
