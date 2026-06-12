-- Align Shopify OAuth scopes: read-only + write_checkouts (minimum for cart recovery)
ALTER TABLE shopify_connections
  ALTER COLUMN scopes SET DEFAULT ARRAY['read_orders','read_customers','read_checkouts','read_products','write_checkouts']::text[];

-- Update integration catalog scopes
UPDATE integration_catalog
  SET scopes = ARRAY['read_orders','read_customers','read_checkouts','read_products','write_checkouts']
  WHERE provider_key = 'shopify';
