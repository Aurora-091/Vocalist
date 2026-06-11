// Shared constants for billing, metering, and spend guard logic.
// Centralise here so changes propagate to every consumer automatically.

/** Minutes projected per outbound call for pre-flight spend checks. */
const DEFAULT_PROJECTED_MINUTES = 3;

/** Fallback overage rate when org has no plan tier configured ($/min). */
const DEFAULT_OVERAGE_RATE_USD = 0.18;

/** Fallback cost estimate used by ElevenLabs before real duration is known ($/min). */
const DEFAULT_COST_PER_MINUTE_USD = 0.15;

/** Usage percentage thresholds that trigger notifications and alerts. */
const ALERT_THRESHOLDS = [80, 100];

module.exports = {
  DEFAULT_PROJECTED_MINUTES,
  DEFAULT_OVERAGE_RATE_USD,
  DEFAULT_COST_PER_MINUTE_USD,
  ALERT_THRESHOLDS,
};
