const { PostHog } = require("posthog-node");

let client = null;
let initialized = false;

function getPostHogClient() {
  if (initialized) return client;
  initialized = true;

  if (!process.env.POSTHOG_KEY) return null;

  client = new PostHog(process.env.POSTHOG_KEY, {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 20,
    flushInterval: 10_000,
  });

  return client;
}

async function shutdownPostHog() {
  if (client) await client.shutdown();
}

module.exports = { getPostHogClient, shutdownPostHog };
