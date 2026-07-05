-- Create custom vault helper schema functions if not already present
DROP FUNCTION IF EXISTS vault_store(text, text);
CREATE OR REPLACE FUNCTION vault_store(p_name text, p_secret text)
RETURNS void SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  -- Insert or update secrets in vault table
  INSERT INTO vault.decrypted_secrets (name, secret, description)
  VALUES (p_name, p_secret, 'Weeber encrypted integration credential')
  ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS vault_read(text);
CREATE OR REPLACE FUNCTION vault_read(p_name text)
RETURNS text SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE decrypted_secrets.name = vault_read.p_name;
  
  RETURN v_secret;
END;
$$ LANGUAGE plpgsql;

-- Revoke public permissions for vault RPC functions
REVOKE EXECUTE ON FUNCTION vault_store(text, text) FROM public;
REVOKE EXECUTE ON FUNCTION vault_read(text) FROM public;

-- Reload the schema cache so the API recognizes the new functions immediately
NOTIFY pgrst, 'reload schema';
