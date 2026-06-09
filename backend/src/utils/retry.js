const logger = require("../config/logger");

/**
 * Resilient fetch wrapper that retries on network failures or transient status codes (429, 502, 503, 504).
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3, initialDelay = 500) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }

      const retryableStatuses = [429, 502, 503, 504];
      if (attempt < maxRetries && retryableStatuses.includes(response.status)) {
        attempt++;
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn({ url, status: response.status, attempt, delay }, "Transient HTTP error, retrying");
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < maxRetries) {
        attempt++;
        const delay = initialDelay * Math.pow(2, attempt - 1);
        logger.warn({ url, err: err.message, attempt, delay }, "Fetch connection failed, retrying");
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

module.exports = { fetchWithRetry };
