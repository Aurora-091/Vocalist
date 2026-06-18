-- Update Shopify integration catalog entry to OAuth2 flow (via weebersh.com)
UPDATE integration_catalog
SET
  auth_type = 'oauth2',
  scopes = ARRAY['read_orders', 'read_customers', 'read_checkouts', 'read_products', 'write_checkouts'],
  setup_instructions = '[{"step": 1, "text": "Enter your Shopify store domain"}, {"step": 2, "text": "Click Connect to authorize Weeber in your Shopify admin"}, {"step": 3, "text": "You will be redirected back automatically once complete"}]'::jsonb
WHERE provider_key = 'shopify';
