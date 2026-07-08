-- Drop the pgvector knowledge_chunks table and the vector extension.
--
-- Rationale: the Knowledge Base is CAI-native (Non-Negotiable #10 in
-- docs/Weeber-Cursor-Rules.md; docs/archive/Aurora-v1-Scope-and-Build-Contract.md
-- explicitly excludes pgvector/knowledge_chunks). Verified against the live DB
-- on 2026-07-08 before dropping:
--   * knowledge_chunks has 0 rows
--   * no backend/frontend/edge-function code references it
--   * no DB function, view, foreign key, or cron job references it
--   * knowledge_chunks.embedding is the only vector-typed column in the DB
--
-- DROP EXTENSION is intentionally non-CASCADE: it fails loudly if any
-- dependency was missed instead of silently removing it.

DROP TABLE IF EXISTS public.knowledge_chunks CASCADE;
DROP EXTENSION IF EXISTS vector;
