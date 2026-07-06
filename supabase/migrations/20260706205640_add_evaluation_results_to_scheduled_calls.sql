-- Task 4: Add evaluation_results JSONB column to scheduled_calls
-- Stores per-criterion scores returned by ElevenLabs post-call analysis
ALTER TABLE scheduled_calls
  ADD COLUMN IF NOT EXISTS evaluation_results JSONB;

COMMENT ON COLUMN scheduled_calls.evaluation_results
  IS 'ElevenLabs post-call evaluation results keyed by criterion identifier, e.g. {"call_successful": {"passed": true, "rationale": "..."}}';
