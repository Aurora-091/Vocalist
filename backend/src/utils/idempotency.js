const crypto = require("crypto");

function buildIdempotencyKey(parts) {
  const data = parts.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 48);
}

module.exports = { buildIdempotencyKey };
