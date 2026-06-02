const pino = require("pino");
const env = require("./env");

const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "aurora-api", env: env.NODE_ENV },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.api_key",
      "*.stripe_customer_id",
    ],
    censor: "[REDACTED]",
  },
});

module.exports = logger;
