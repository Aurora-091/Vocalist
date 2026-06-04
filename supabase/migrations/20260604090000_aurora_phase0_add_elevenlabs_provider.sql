/*
  # Aurora Phase 0: register `elevenlabs` as a voice provider

  Adds 'elevenlabs' to the `voice_provider` enum so the Phase-1 runtime
  can mark agents created in ElevenLabs Conversational AI.

  Per Scope §I.5 ("Phase 1 = ElevenLabs CAI registered; Vapi compiled but
  NOT registered in the factory"), Vapi stays a valid enum value so any
  existing agents with `provider='vapi'` keep validating; the factory will
  refuse to instantiate them in PR #9.

  1. Enum changes
    - voice_provider += 'elevenlabs'

  2. Notes
    - Enum values cannot be removed, so we don't need a down migration.
    - This migration is independently safe to apply before any code lands.
*/

DO $$ BEGIN
  ALTER TYPE voice_provider ADD VALUE IF NOT EXISTS 'elevenlabs';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
