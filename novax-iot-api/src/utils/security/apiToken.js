const crypto = require("crypto");

const TOKEN_PREFIX = "nvx_live";

function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function generateApiToken() {
  const secret = crypto.randomBytes(32).toString("base64url");
  const visiblePrefix = secret.slice(0, 10);
  const token = `${TOKEN_PREFIX}_${visiblePrefix}_${secret}`;

  return {
    token,
    tokenHash: hashToken(token),
    tokenPrefix: `${TOKEN_PREFIX}_${visiblePrefix}`,
  };
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { generateApiToken, hashToken, safeEqual };
