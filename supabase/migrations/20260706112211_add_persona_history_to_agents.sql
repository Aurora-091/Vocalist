-- Add persona_history column to store last N versions of the persona
ALTER TABLE agents ADD COLUMN IF NOT EXISTS persona_history jsonb DEFAULT '[]'::jsonb;

-- Index for queries that inspect history metadata
CREATE INDEX IF NOT EXISTS agents_persona_history_gin ON agents USING GIN (persona_history);
