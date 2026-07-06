const RETRY_DELAYS_MINUTES = [30, 120, 480];
const MAX_ATTEMPTS = 3;

function getNextRetryDelay(attempt) {
  const idx = Math.min(attempt - 1, RETRY_DELAYS_MINUTES.length - 1);
  return RETRY_DELAYS_MINUTES[idx];
}

function canRetry(attempt) {
  return attempt < MAX_ATTEMPTS;
}

function isWithinQuietHours(date, startHour = 9, endHour = 21, timezone = "Asia/Kolkata") {
  const localTime = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const hour = localTime.getHours();
  return hour < startHour || hour >= endHour;
}

function nextBusinessWindow(date, startHour = 9, timezone = "Asia/Kolkata") {
  const localTime = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const hour = localTime.getHours();

  if (hour >= startHour) {
    localTime.setDate(localTime.getDate() + 1);
  }
  localTime.setHours(startHour, 0, 0, 0);

  const offset = date.getTime() - new Date(date.toLocaleString("en-US", { timeZone: timezone })).getTime();
  return new Date(localTime.getTime() + offset);
}

function computeRetryAt(now, attempt, { startHour = 9, endHour = 21, timezone = "Asia/Kolkata" } = {}) {
  const delayMs = getNextRetryDelay(attempt) * 60 * 1000;
  const candidate = new Date(now.getTime() + delayMs);

  if (isWithinQuietHours(candidate, startHour, endHour, timezone)) {
    return nextBusinessWindow(candidate, startHour, timezone);
  }
  return candidate;
}

function clampToQuietHours(date, { startHour = 9, endHour = 21, timezone = "Asia/Kolkata" } = {}) {
  if (isWithinQuietHours(date, startHour, endHour, timezone)) {
    return nextBusinessWindow(date, startHour, timezone);
  }
  return date;
}

module.exports = { getNextRetryDelay, canRetry, isWithinQuietHours, nextBusinessWindow, computeRetryAt, clampToQuietHours, MAX_ATTEMPTS };
