-- Task 4: Extend preset/persona analysis_config to include evaluation/success criteria
-- Keeps existing data_collection intact.

-- shopify_cart_recovery: purchase_intent: high|medium|none
UPDATE agent_presets
SET persona = jsonb_set(
  persona,
  '{analysis_config}',
  coalesce(persona->'analysis_config', '{}'::jsonb) || '{"evaluation_criteria": [{"identifier": "purchase_intent", "description": "Determine the customer''s purchase intent. Return high, medium, or none."}]}'::jsonb
)
WHERE preset_key = 'shopify_cart_recovery';

-- shopify_cod_confirmation: cod_confirmed: boolean + cancel_requested: boolean
UPDATE agent_presets
SET persona = jsonb_set(
  persona,
  '{analysis_config}',
  coalesce(persona->'analysis_config', '{}'::jsonb) || '{"evaluation_criteria": [{"identifier": "cod_confirmed", "description": "Determine if the customer confirmed their Cash on Delivery (COD) order. Return true if confirmed."}, {"identifier": "cancel_requested", "description": "Determine if the customer requested to cancel their order. Return true if cancellation requested."}]}'::jsonb
)
WHERE preset_key = 'shopify_cod_confirmation';

-- shopify_feedback_collection: rating: 1-5 + consented_to_review: boolean
UPDATE agent_presets
SET persona = jsonb_set(
  persona,
  '{analysis_config}',
  coalesce(persona->'analysis_config', '{}'::jsonb) || '{"evaluation_criteria": [{"identifier": "rating", "description": "Determine the customer''s rating from 1 to 5. Return the numeric value."}, {"identifier": "consented_to_review", "description": "Determine if the customer consented to leave a review. Return true if they consented."}]}'::jsonb
)
WHERE preset_key = 'shopify_feedback_collection';

-- Task 3 Correction: Fix conversation_style presets defaults for feedback & winback presets (resolving minor typos in 20260706205601 migration)
UPDATE agent_presets
SET persona = persona || jsonb_build_object('conversation_style', 'balanced')
WHERE preset_key IN ('shopify_feedback_collection', 'shopify_winback');
