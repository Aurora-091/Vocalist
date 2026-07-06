/*
# Seed Feedback Collection Agent Preset

## Summary
Adds a feedback collection agent preset for the Shopify vertical.
This agent calls customers 2 days after order fulfillment to check
satisfaction, collect a 1-5 star rating, and ask for a public review
if the customer is happy.

## New Data
- 1 new row in `agent_presets` table
  - vertical_key: shopify
  - preset_key: shopify_feedback_collection
  - direction: outbound
  - No tools (outcome captured via post-call analysis)

## Important Notes
1. Uses the same voice (Antoni) as the COD confirmation preset for consistency.
2. Prompt is designed for Indian D2C context — warm, brief (under 90 seconds).
3. Idempotent: skips insert if preset_key already exists.
*/

INSERT INTO agent_presets (vertical_key, preset_key, name, description, direction, persona, tools, voice_id, voice_name, languages, consent_required, sort_order)
SELECT
  'shopify',
  'shopify_feedback_collection',
  'Feedback Collection',
  'Calls customers 2 days after delivery to check satisfaction, collect a star rating, and request reviews from happy customers.',
  'outbound',
  '{"objective": "Call the customer after order delivery to verify everything arrived well, collect a 1-5 star satisfaction rating, capture verbatim feedback, and if they rate 4 or 5 stars ask if they would be willing to leave a public review.",
    "tone": "warm, appreciative, brief",
    "system_prompt": "You are calling on behalf of {{business_name}} to follow up on a recent delivery.\n\nRules:\n- Thank the customer for their purchase\n- Ask if the order arrived in good condition\n- Ask them to rate their experience from 1 to 5 stars\n- If they give any specific feedback, listen and acknowledge\n- If they rate 4 or 5 stars, ask if they would be open to leaving a quick review (mention you will send a link via SMS)\n- If they rate 1-3 stars, empathize and ask what went wrong. Offer to connect them with support if needed\n- Never argue or be defensive about negative feedback\n- Keep the call under 90 seconds\n- Thank them regardless of the rating\n\nContext:\n- Customer: {{customer_name}}\n- Order number: {{order_number}}\n- Items ordered: {{order_items}}",
    "first_message": "Hi {{customer_name}}, this is {{agent_name}} from {{business_name}}. I am just calling to check if your recent order arrived safely. Do you have a quick moment?",
    "guardrails": ["Never argue with negative feedback", "Do not offer discounts or compensation — route to support instead", "Keep under 90 seconds", "If customer is busy, offer to call back later", "Respect DNC requests immediately"]
  }'::jsonb,
  '[]'::jsonb,
  'ErXwobaYiN019PkySvjV',
  'Antoni',
  ARRAY['en'],
  true,
  9
WHERE NOT EXISTS (
  SELECT 1 FROM agent_presets WHERE preset_key = 'shopify_feedback_collection'
);