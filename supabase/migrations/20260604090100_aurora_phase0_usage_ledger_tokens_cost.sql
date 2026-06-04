/*
  # Aurora Phase 0: usage_ledger tokens + cost + llm_tokens meter kind

  Implements Scope §I.12 ("Spend guards meter on cost_usd, not minutes")
  and the dollar-metering side of §E.1 spend guards.

  Critique #4 fix: pass-through LLM token cost can silently blow the
  $0.15/min planning floor unless tokens and cost are first-class on
  the usage ledger. This migration makes that data first-class so the
  guard in `can_spend()` (next migration) trips on real dollars.

  1. Enum changes
    - meter_kind += 'llm_tokens'

  2. Column changes — `usage_ledger`
    - + tokens_in  integer  (nullable: only set on llm_tokens rows)
    - + tokens_out integer  (nullable: only set on llm_tokens rows)
    - + cost_usd   numeric(12,4) (nullable: backfilled by webhook handler)

  3. Indexing
    - usage_ledger_org_cost_idx covers (org_id, occurred_at desc) INCLUDE (cost_usd)
      so the spend guard's daily/monthly aggregation can index-only scan.

  4. Notes
    - All new columns are nullable + additive; no backfill, no constraint
      violations on historical rows.
    - The `usage_ledger` table is PARTITIONED by occurred_at. Indexes on
      partitioned tables are not auto-created on existing partitions in
      older Postgres versions; we CREATE INDEX IF NOT EXISTS on each
      existing partition explicitly to be safe.
    - Invariant #11 (CI fixture, not enforced at DB level): every
      usage_ledger row for a completed call MUST carry a non-null
      cost_usd. Enforcement is in PR 2.3's webhook handler.
*/

-- 1) New meter kind
DO $$ BEGIN
  ALTER TYPE meter_kind ADD VALUE IF NOT EXISTS 'llm_tokens';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) New columns on the partitioned parent
ALTER TABLE usage_ledger
  ADD COLUMN IF NOT EXISTS tokens_in  integer,
  ADD COLUMN IF NOT EXISTS tokens_out integer,
  ADD COLUMN IF NOT EXISTS cost_usd   numeric(12,4);

-- 3) Aggregation-friendly index on each existing partition.
--    Composite (org_id, occurred_at desc) INCLUDE (cost_usd) means the
--    spend guard's "rolling sum by org over a window" can be served
--    index-only without heap fetches.
DO $$
DECLARE
  part record;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass AS partname
      FROM pg_inherits
     WHERE inhparent = 'usage_ledger'::regclass
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %s (org_id, occurred_at DESC) INCLUDE (cost_usd)',
      replace(part.partname::text, '.', '_') || '_org_cost_idx',
      part.partname
    );
  END LOOP;
END $$;
