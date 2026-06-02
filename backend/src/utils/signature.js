const crypto = require("crypto");

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacSha256(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyHmacSha256(secret, payload, providedSignature) {
  if (!secret || !providedSignature) return false;
  const expected = hmacSha256(secret, payload);
  return timingSafeEqual(expected, providedSignature);
}

function verifyVapiSignature(secret, payload, header) {
  if (!secret) return process.env.NODE_ENV !== "production";
  return verifyHmacSha256(secret, payload, header || "");
}

function verifyTwilioSignature(authToken, url, params, providedSignature) {
  if (!authToken) return process.env.NODE_ENV !== "production";
  const sortedKeys = Object.keys(params || {}).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  return timingSafeEqual(expected, providedSignature || "");
}

module.exports = { hmacSha256, verifyHmacSha256, verifyVapiSignature, verifyTwilioSignature, timingSafeEqual };
