const crypto = require("crypto");
const logger = require("../config/logger");

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
  if (!secret) {
    logger.warn("VAPI_WEBHOOK_SECRET not configured - rejecting webhook");
    return false;
  }
  return verifyHmacSha256(secret, payload, header || "");
}

const ELEVENLABS_TOLERANCE_SECONDS = 30 * 60;

function verifyElevenLabsSignature(secret, payload, header) {
  if (!secret || !header) return false;

  const parts = {};
  for (const segment of header.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  }
  const timestamp = parts.t;
  const signature = parts.v0;
  if (!timestamp || !signature) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > ELEVENLABS_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = hmacSha256(secret, `${timestamp}.${payload}`);
  return timingSafeEqual(expected, signature);
}

function verifyTwilioSignature(authToken, url, params, providedSignature) {
  if (!authToken) {
    logger.warn("TWILIO_AUTH_TOKEN not configured - rejecting webhook");
    return false;
  }
  const sortedKeys = Object.keys(params || {}).sort();
  const data = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");
  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  return timingSafeEqual(expected, providedSignature || "");
}

module.exports = {
  hmacSha256,
  verifyHmacSha256,
  verifyVapiSignature,
  verifyElevenLabsSignature,
  verifyTwilioSignature,
  timingSafeEqual,
};
