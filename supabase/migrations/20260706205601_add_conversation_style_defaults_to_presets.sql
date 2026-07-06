-- Task 3: Set default conversation_style on agent presets
-- cart_recovery / cod_confirm → "quick" (time-sensitive, transactional)
-- feedback / win-back / appointment → "balanced" (relationship-focused)
-- everything else left as null (provider falls back to EL default)

UPDATE agent_presets
SET persona = persona || jsonb_build_object('conversation_style', 'quick')
WHERE preset_key IN (
  'shopify_cart_recovery',
  'shopify_cod_confirmation'
);

UPDATE agent_presets
SET persona = persona || jsonb_build_object('conversation_style', 'balanced')
WHERE preset_key IN (
  'shopify_feedback',
  'shopify_win_back',
  'feedback_survey'
)
   OR direction = 'inbound';
