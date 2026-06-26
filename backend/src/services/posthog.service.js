const logger = require("../config/logger");

const POSTHOG_HOST = process.env.POSTHOG_HOST || "https://us.i.posthog.com";
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

function isConfigured() {
  return !!(POSTHOG_API_KEY && POSTHOG_PROJECT_ID);
}

/**
 * Run a HogQL query against the PostHog Query API.
 * @param {string} hogql - HogQL query string
 * @returns {Promise<{columns: string[], results: any[][]}>}
 */
async function runHogQL(hogql) {
  if (!isConfigured()) {
    throw new Error("PostHog API key or project ID not configured");
  }

  const url = `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${POSTHOG_API_KEY}`,
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: hogql },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "PostHog query failed");
    throw new Error(`PostHog API error: ${res.status}`);
  }

  const data = await res.json();
  return { columns: data.columns || [], results: data.results || [] };
}

/**
 * Convert a range string (today, 7d, 30d) to a HogQL date filter expression.
 */
function rangeToFilter(range) {
  switch (range) {
    case "today":
      return "timestamp >= today()";
    case "7d":
      return "timestamp >= now() - interval 7 day";
    case "30d":
      return "timestamp >= now() - interval 30 day";
    case "90d":
      return "timestamp >= now() - interval 90 day";
    default:
      return "timestamp >= now() - interval 7 day";
  }
}

/**
 * Get the previous period filter for comparison.
 */
function prevRangeToFilter(range) {
  switch (range) {
    case "today":
      return "timestamp >= today() - interval 1 day AND timestamp < today()";
    case "7d":
      return "timestamp >= now() - interval 14 day AND timestamp < now() - interval 7 day";
    case "30d":
      return "timestamp >= now() - interval 60 day AND timestamp < now() - interval 30 day";
    case "90d":
      return "timestamp >= now() - interval 180 day AND timestamp < now() - interval 90 day";
    default:
      return "timestamp >= now() - interval 14 day AND timestamp < now() - interval 7 day";
  }
}

/**
 * Summary stats: unique users, total events, pageviews, sessions.
 * Returns current and previous period values for trend comparison.
 */
async function getInsights(range = "7d") {
  const filter = rangeToFilter(range);
  const prevFilter = prevRangeToFilter(range);

  const query = `
    SELECT
      uniq(distinct_id) AS unique_users,
      count() AS total_events,
      countIf(event = '$pageview') AS pageviews,
      uniq(properties.$session_id) AS sessions
    FROM events
    WHERE ${filter}
  `;

  const prevQuery = `
    SELECT
      uniq(distinct_id) AS unique_users,
      count() AS total_events,
      countIf(event = '$pageview') AS pageviews,
      uniq(properties.$session_id) AS sessions
    FROM events
    WHERE ${prevFilter}
  `;

  const [current, prev] = await Promise.all([runHogQL(query), runHogQL(prevQuery)]);

  const c = current.results[0] || [0, 0, 0, 0];
  const p = prev.results[0] || [0, 0, 0, 0];

  return {
    unique_users: c[0],
    total_events: c[1],
    pageviews: c[2],
    sessions: c[3],
    prev_unique_users: p[0],
    prev_total_events: p[1],
    prev_pageviews: p[2],
    prev_sessions: p[3],
  };
}

/**
 * Top 10 visited pages.
 */
async function getTopPages(range = "7d") {
  const filter = rangeToFilter(range);
  const query = `
    SELECT
      properties.$current_url AS url,
      count() AS views,
      uniq(distinct_id) AS unique_users
    FROM events
    WHERE event = '$pageview' AND ${filter}
    GROUP BY url
    ORDER BY views DESC
    LIMIT 10
  `;
  const { results } = await runHogQL(query);
  return results.map((r) => ({ url: r[0], views: r[1], unique_users: r[2] }));
}

/**
 * Top 10 custom events (excluding standard PostHog events).
 */
async function getTopEvents(range = "7d") {
  const filter = rangeToFilter(range);
  const query = `
    SELECT
      event,
      count() AS count,
      uniq(distinct_id) AS unique_users
    FROM events
    WHERE ${filter}
      AND event NOT LIKE '$%'
    GROUP BY event
    ORDER BY count DESC
    LIMIT 10
  `;
  const { results } = await runHogQL(query);
  return results.map((r) => ({ event: r[0], count: r[1], unique_users: r[2] }));
}

/**
 * Daily unique users time series.
 */
async function getUserActivity(range = "30d") {
  const filter = rangeToFilter(range);
  const query = `
    SELECT
      toDate(timestamp) AS day,
      uniq(distinct_id) AS users
    FROM events
    WHERE ${filter}
    GROUP BY day
    ORDER BY day ASC
  `;
  const { results } = await runHogQL(query);
  return results.map((r) => ({ date: r[0], users: r[1] }));
}

/**
 * Top traffic sources / referrers.
 */
async function getReferrers(range = "7d") {
  const filter = rangeToFilter(range);
  const query = `
    SELECT
      properties.$referrer AS referrer,
      count() AS visits,
      uniq(distinct_id) AS unique_users
    FROM events
    WHERE event = '$pageview'
      AND ${filter}
      AND properties.$referrer IS NOT NULL
      AND properties.$referrer != ''
    GROUP BY referrer
    ORDER BY visits DESC
    LIMIT 15
  `;
  const { results } = await runHogQL(query);
  return results.map((r) => ({ referrer: r[0], visits: r[1], unique_users: r[2] }));
}

/**
 * Top countries by unique users.
 */
async function getCountries(range = "7d") {
  const filter = rangeToFilter(range);
  const query = `
    SELECT
      properties.$geoip_country_name AS country,
      uniq(distinct_id) AS users,
      count() AS events
    FROM events
    WHERE ${filter}
      AND properties.$geoip_country_name IS NOT NULL
      AND properties.$geoip_country_name != ''
    GROUP BY country
    ORDER BY users DESC
    LIMIT 15
  `;
  const { results } = await runHogQL(query);
  return results.map((r) => ({ country: r[0], users: r[1], events: r[2] }));
}

module.exports = {
  isConfigured,
  getInsights,
  getTopPages,
  getTopEvents,
  getUserActivity,
  getReferrers,
  getCountries,
};
