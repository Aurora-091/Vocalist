-- Fix vault_store / vault_read to go through the Supabase Vault API.
--
-- The 20260704000001 versions were broken in production:
--   * vault_store did INSERT INTO vault.decrypted_secrets — a read-only view with
--     no INSTEAD OF trigger, and the postgres definer has no INSERT privilege on it.
--     Every call failed with "permission denied for view decrypted_secrets", so no
--     secret was ever stored (vault.secrets was empty).
--   * vault_read selected the `secret` column (ciphertext); the plaintext lives in
--     `decrypted_secret`.
--
-- Writes must use vault.create_secret() / vault.update_secret() (SECURITY DEFINER,
-- owned by supabase_admin). CREATE OR REPLACE without DROP preserves the grants
-- applied in 20260705214515 (service_role only; anon/authenticated revoked).

CREATE OR REPLACE FUNCTION public.vault_store(p_name text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    BEGIN
      PERFORM vault.create_secret(p_secret, p_name, 'Weeber encrypted integration credential');
    EXCEPTION WHEN unique_violation THEN
      -- Concurrent caller created it between our check and insert; update instead.
      SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
      PERFORM vault.update_secret(v_id, p_secret);
    END;
  ELSE
    PERFORM vault.update_secret(v_id, p_secret);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_read(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name;

  RETURN v_secret;
END;
$$;

-- Reload the schema cache so PostgREST serves the new definitions immediately
NOTIFY pgrst, 'reload schema';
