# Supabase Vault Credentials Setup Guide 🔒

This guide documents the credential storage system used on the Weeber platform. We utilize the Supabase Vault extension to prevent raw plaintext secrets (such as Shopify access tokens, Twilio tokens, API keys) from being saved in database text rows.

---

## 1. How It Works

*   When a user updates an integration configuration (via the `PUT /` integrations router), the request parameters are routed through the backend.
*   Plaintext secret fields (e.g. `access_token`, `auth_token`) are extracted and written directly into the vault schema using the database RPC `vault_store`.
*   A vault reference link (`vault:integrations:{type}:{field}:{org_id}`) is generated and saved in the integrations table configuration JSONB column instead.
*   Prior to dispatching requests to external API partners, the base provider runs `resolveConfigSecrets` which calls `vault_read` RPC to retrieve the plaintext keys into memory dynamically.

---

## 2. Supabase SQL Schema setup

To configure the database functions and RPC mappings, run the following SQL commands in your Supabase SQL editor:

```sql
-- Create custom vault helper schema functions if not already present
CREATE OR REPLACE FUNCTION vault_store(name text, secret text)
RETURNS void SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Insert or update secrets in vault table
  INSERT INTO vault.decrypted_secrets (name, secret, description)
  VALUES (name, secret, 'Weeber encrypted integration credential')
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION vault_read(name text)
RETURNS text SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE decrypted_secrets.name = vault_read.name;
  
  RETURN v_secret;
END;
$$ LANGUAGE plpgsql;

-- Revoke public permissions for vault RPC functions
REVOKE EXECUTE ON FUNCTION vault_store(text, text) FROM public;
REVOKE EXECUTE ON FUNCTION vault_read(text) FROM public;
```

---

## 3. Backend Code Integration

The helper module [credential.helper.js](../../utils/credential.helper.js) exposes the following API interface:

*   **`writeSecret(name, value)`**: Writes the key/secret into the vault via `vault_store` RPC.
*   **`readSecret(name)`**: Reads the plaintext secret back via `vault_read` RPC.
*   **`resolveConfigSecrets(config)`**: Scans the config object, detects any values starting with `vault:`, resolves them against the vault database tables, and returns the resolved config structure.
