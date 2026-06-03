const ApiError = require("./ApiError");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isString(v) {
  return typeof v === "string";
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isUuid(v) {
  return typeof v === "string" && UUID_REGEX.test(v);
}

function isEmail(v) {
  return typeof v === "string" && EMAIL_REGEX.test(v.trim());
}

function isStrongPassword(v) {
  if (typeof v !== "string" || v.length < 8) return false;
  const hasLetter = /[A-Za-z]/.test(v);
  const hasNumber = /\d/.test(v);
  return hasLetter && hasNumber;
}

function assert(condition, message, details) {
  if (!condition) throw ApiError.badRequest(message, details);
}

module.exports = {
  UUID_REGEX,
  EMAIL_REGEX,
  isString,
  isNonEmptyString,
  isUuid,
  isEmail,
  isStrongPassword,
  assert,
};
