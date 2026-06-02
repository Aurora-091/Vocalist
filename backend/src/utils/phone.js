const { parsePhoneNumberFromString } = require("libphonenumber-js");
const { BadRequest } = require("./errors");

function toE164(input, defaultCountry = "US") {
  if (!input || typeof input !== "string") {
    throw BadRequest("Phone number is required");
  }
  const trimmed = input.trim();
  const phone = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!phone || !phone.isValid()) {
    throw BadRequest(`Invalid phone number: ${input}`);
  }
  return phone.number;
}

function tryE164(input, defaultCountry = "US") {
  try {
    return toE164(input, defaultCountry);
  } catch {
    return null;
  }
}

module.exports = { toE164, tryE164 };
