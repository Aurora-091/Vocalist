/*
# Enable Supabase Realtime on Campaigns and Calls Tables

1. Changes
  - Adds `campaigns` table to `supabase_realtime` publication
  - Adds `calls` table to `supabase_realtime` publication
  - Enables live status updates pushed to frontend clients

2. Why
  - Campaign status transitions (running → completed, running → paused) are currently
    only visible after page refresh or polling
  - Call progress during active campaigns (new calls appearing in real-time)
  - Enables instant UI feedback when campaigns auto-complete

3. Security
  - Realtime respects existing RLS policies — clients only receive changes for
    rows they have SELECT permission on (org-scoped via auth_org())
  - No additional policies needed

4. Important Notes
  - The `supabase_realtime` publication is managed by Supabase and already exists
  - Adding tables is idempotent via IF NOT EXISTS semantics
  - Frontend subscribes via `.channel().on('postgres_changes', ...)`
*/

-- Add campaigns to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
  END IF;
END $$;

-- Add calls to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calls;
  END IF;
END $$;
