const { randomUUID } = require("node:crypto");

// Full UUID entropy avoids MAX(code)+1 races; database uniqueness remains authoritative.
function automaticCode(prefix) {
  if (!/^[A-Z]{2,6}$/.test(prefix)) throw new Error("Invalid automatic code prefix");
  return `${prefix}-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

module.exports = automaticCode;
