# Aurora — v1 Scope & Build Contract

> **The single source of truth for what v1 is.** Read this first. It is the *map*, not a duplicate — each feature links to the detailed doc that specs it. If a feature isn't here, it isn't in v1. If it's here, it ships with the acceptance criteria below. This exists so engineering finds **no loopholes mid-build**.

**Launch verticals:** Shopify merchant · Clinic (appointment SMB). Verticals are **config rows** (`vertical_configs`), never hardcoded — model is tenant-ready, only these two ship in v1 UI.

**Stack (binding):** Bun + Hono + TS · Supabase (Postgres/RLS/Auth/Realtime/Edge/Storage) · Vapi (MVP voice runtime) behind a `VoiceProvider` seam → Pipecat (Phase 4) · Stripe (subscriptions + metered) · Twilio (numbers + SMS).

**Companion docs:**
[Black Book](Aurora-BlackBook.md) · [Database Guide](database-guide.md) · [UI/UX Spec](Aurora-UIUX-Spec.md) · [User-Flow & Knowledge](Aurora-UserFlow-and-Knowledge.md) · [Agent Template Library](Aurora-AgentTemplateLibrary.md) · Product PRD · Red-Team Review.

---

## 0. Scope at a glance

| # | Capability | In v1 | Spec home | Status |
|---|---|:---:|---|---|
| 1 | Auth + tenant (org) bootstrap | ✅ | DB Guide §3 | specced |
| 2 | Dashboard Setup Checklist (no wizard wall) | ✅ | User-Flow §1 | specced |
| 3 | Vertical picker + per-vertical branching | ✅ | User-Flow §2, §10 | specced |
| 4 | Integrations connect (Shopify / Cal.com / Google / Outlook / CRM / Zapier / Stripe / Twilio) | ✅ | UI §6.8, BB | specced |
| 5 | No-code Agent Builder (+ Advanced toggle) | ✅ | User-Flow §4, UI §6.3 | specced |
| 6 | Agent Template Library (17 templates) | ✅ | Template Library | specced |
| 7 | Knowledge Base (upload / website / integration · pgvector RAG · org-wide, subscribe) | ✅ | User-Flow §5, DB §3.1 | specced |
| 8 | Phone numbers (per-tenant Twilio subaccount OR BYO) | ✅ | User-Flow §6, DB §3.1 | specced |
| 9 | Local CRM (contacts) import (Excel/CSV/Sheets) + export (Excel/CSV) | ✅ | User-Flow §7 | specced |
| 10 | Consent + DNC + `can_dial()` gate (TCPA core) | ✅ | DB §4, §4.3 | specced |
| 11 | Inbound call handling | ✅ | BB, UI §7.2 | specced |
| 12 | Triggered outbound | ✅ | BB, DB §5 | specced |
| 13 | Campaign engine **tied to CRM tags/segments** | ✅ | **this doc §C, UI §6.4** | **specced here** |
| 14 | Calls: recordings + transcripts viewer | ✅ | DB §6, UI §6.6 | specced |
| 15 | Outcomes / Analytics dashboard **(metrics defined)** | ✅ | **this doc §D** | **specced here** |
| 16 | Billing: Stripe subscriptions + metered usage + **default tiers** | ✅ | DB §11, **this doc §E** | **tiers here (placeholder)** |
| 17 | Settings page (notif prefs · calling-hours defaults · org profile · billing access · **whitelabel**) | ✅ | **this doc §F** | **specced here** |
| 18 | Test-call-yourself | ✅ | User-Flow §8 | specced |
| 19 | Business hours / timezone per agent | ✅ | User-Flow §9, DB | specced |
| 20 | Notifications (email + in-app) | ✅ | DB §3.1, §F | specced |
| 21 | Call transfer / escalation to human | ✅ | User-Flow §9, DB | specced |
| 22 | Multi-language EN/ES per agent | ✅ | User-Flow §9 | specced |
| 23 | **Whitelabel basic UI** (logo + brand color on console + emails) | ✅ | **this doc §F.4** | **overrides PRD** |
| 24 | Webhook / Zapier OUT (call outcomes) | ✅ | DB §3.1 | specced |
| 25 | Error & empty states standard | ✅ | **this doc §G**, UI §8 | **formalized here** |
| 26 | RLS on every tenant table + invariants | ✅ | DB §10, Appendix | specced |

Everything not in this table → **§B Out of scope** or **§H Deferred / fast-follow.**

---

## A. Acceptance criteria — per capability

> Each item is **done** only when its AC passes. Keep these green; reinvest freed capacity into the compliance/idempotency/RLS tests (per DB Guide build order).

**1. Auth + tenant bootstrap**
- Signup creates `orgs` + `users` (role `owner`) + `onboarding_state` + JWT `org_id` claim, in one transaction.
- AC: a new user lands on `/` authenticated; their `org_id` is on every subsequent query; no cross-org row is ever readable (RLS test).

**2. Dashboard Setup Checklist**
- 6 steps from `onboarding_state`; deep-link out, tick back; dismissible; reappears as slim banner until `test_and_golive`.
- AC: progress survives refresh + device switch (server-side); "Create agent" + "Get a number" gate go-live; completing all collapses the card.

**3. Vertical picker + branching**
- Selecting writes `orgs.vertical_config_id`; integrations offered, recommended templates, knowledge prompts, contact fields, glossary all read from `vertical_configs.config`.
- AC: switching the seed config row changes the whole downstream UI with **zero code change** (proves no hardcoding).

**4. Integrations**
- OAuth/API connect per type; secrets via `secret_ref` (Vault), never plaintext; `unique(org_id,type)`.
- AC: connect → status active → the relevant agent tools unlock + integration-sourced knowledge becomes addable; disconnect hides them; broken integration raises an in-app banner.

**5. No-code Agent Builder**
- Friendly fields compose into `persona`; Advanced exposes raw prompt + tools (greyed unless integration connected) + read-only consent flag.
- AC: create from blank or template; outbound agents are **forced** `consent_required:true` (cannot be unset); no "LLM"/"prompt"/"webhook" word appears in default view.

**6. Agent Template Library**
- 17 templates seedable; pre-fill the builder; per-vertical recommended set.
- AC: picking a template fills name/goal/personality/first-message/voice/tools/consent; outbound templates carry opt-out handling.

**7. Knowledge Base**
- Sources: document upload, website crawl, integration pull → chunk → embed (pgvector); org-wide; agents subscribe via `agent_knowledge`.
- AC: retrieval is scoped to `org_id` **AND** the agent's subscribed sources; below-threshold → agent defers to human (never fabricates); status lifecycle processing→ready/error shown; re-sync works.

**8. Phone numbers**
- Aurora-managed = per-tenant **Twilio subaccount** (isolation, multi-number, per-tenant billing rollup); BYO = connect own Twilio, pick/port number.
- AC: a tenant can hold >1 number; numbers bind to agents; managed usage attributable per subaccount; BYO billed to tenant's own Twilio; same flow regardless of vertical.

**9. Local CRM**
- Import .xlsx/.csv/Google Sheets with column mapping + **consent attestation gate** for callable contacts (→ `import_attest` events); export .xlsx/.csv respecting filters.
- AC: DNC numbers auto-suppressed on import; export never leaks another org (RLS); attestation required before any imported contact is dialable.

**10. Consent + DNC + `can_dial()`**
- Single gate `can_dial(org_id, e164, now)` = consent ✓ AND not-DNC ✓ AND in calling-hours ✓. Append-only `consent_events`; DNC keyed on E.164.
- AC: no `dialing` transition without an immediately-prior `can_dial()=true`; opt-out (voice/SMS STOP) flips cache+DNC+queued targets in one transaction, honored same run + all future runs; `consent_events`/`dnc_list` never updated/deleted via API.

**11. Inbound**
- Call routes to the bound agent's playbook; tools fire to integrations; recording + transcript + outcome persisted.
- AC: a test inbound call answered by the right agent; transcript + recording viewable; outcome logged.

**12. Triggered outbound**
- Trigger (e.g. abandoned checkout) → enqueue → `can_dial()` → dial via provider; retries + voicemail per config.
- AC: trigger fires within SLA; suppressed contacts logged with reason; voicemail drops the configured short message.

**13. Campaign engine + CRM tags/segments** — see §C.

**14. Calls + recordings/transcripts**
- `calls` holds `recording_url` (Storage, org bucket) + `transcript` + `outcome`; viewer at `/calls/:id`.
- AC: play recording, read transcript, see outcome + event timeline; retention honored (recordings 90d).

**15. Outcomes / Analytics** — see §D.

**16. Billing** — see §E.

**17. Settings + 20/21/23 (notif, hours, whitelabel)** — see §F.

**18. Test-call-yourself**
- Button on every agent; places a real call to the user's own number; logged `test`.
- AC: no consent gate (self); flips the checklist test step; works before go-live.

**19. Business hours / timezone**
- `agents.business_hours` + `agents.timezone` feed `can_dial()` hours check and inbound answering window.
- AC: outbound deferred outside window; inbound out-of-hours routes to the after-hours/voicemail behavior.

**22. Multi-language EN/ES**
- `agents.languages text[]`; per-language backup voice in `persona.voices[]`.
- AC: agent greets/responds in the caller's selected language; EN + ES only (others rejected gracefully).

**24. Webhook / Zapier OUT**
- `webhook_endpoints` fire on configured events (e.g. `call.completed`); HMAC-signed.
- AC: outcome payload delivered + signed; retries on failure; per-org isolation.

**25. Error & empty states** — see §G.
**26. RLS + invariants** — DB Guide §10 + Appendix (7 invariants). AC: `rls-coverage` CI green; all 7 invariants enforced.

---

## B. Explicitly OUT of v1 (no scope creep)

Straight from the PRD — do **not** build these in v1:
- ❌ EHR/PMS integration (NexHealth etc.) — no PHI in v1; clinic uses Cal.com + CRM only.
- ❌ Full HIPAA/BAA program (keep architecture BAA-ready, don't run the program).
- ❌ Custom visual flow-builder (templates + no-code fields only).
- ❌ Languages beyond EN/ES.
- ❌ White-label **reseller** program (basic logo/color UI **is** in — see §F.4; reseller/multi-brand resale is not).
- ❌ Community template marketplace.
- ❌ Self-hosted voice runtime (Pipecat) — Phase 4; v1 is Vapi behind the seam.
- ❌ Third+ verticals in the UI (model is ready; UI ships Shopify + Clinic only).

---

## C. Campaign engine tied to CRM tags/segments  *(specced here)*

**Builder** (`/campaigns/new`) — multi-step, **compliance step mandatory**:
1. **Audience** — pick from: a **tag/segment** (CRM tags), a Shopify pull, a CRM query, or a CSV upload. Segments are saved filters over contacts (e.g. "Past buyers 90d", "Recall due").
2. **Agent/script** — choose an outbound agent (its persona drives the call).
3. **Schedule & limits** — window, concurrency, max retries.
4. **Compliance review** — shows exact counts: consent ✓ / no-consent (skipped) / DNC (skipped) / outside-hours (deferred). Cannot proceed without seeing it.
5. **Launch** — ConfirmGate with explicit consequence ("Dial N contacts? This places real calls.").

**Data:** contacts carry tags; a **segment** = a named filter. Campaign targets are materialized into `campaign_targets` (dialer state machine, idempotent leasing — DB §5). Every target passes `can_dial()` at dial time, not just at build time (consent can change between build and dial).

**AC:**
- Audience can be built from a saved tag/segment in ≤3 clicks.
- Compliance step shows non-zero suppression counts and lists who/why.
- No target dials unless `can_dial()` is true at dial time.
- Opt-out mid-campaign removes the contact from the remaining queue in the same transaction.
- Pausing/stopping is immediate; no in-flight double-dials (idempotency).

*(Detailed wireframe: UI Spec §6.4. Backed by `contacts.tags text[]` + the `segments` saved-filter table — both now in DB Guide §4.)*

---

## D. Outcomes / Analytics dashboard  *(metrics defined)*

**Route:** `/outcomes`. Filters: date range · agent · campaign · vertical.

**Metrics (computed from `calls.outcome` + `call_events` rollups):**

| Metric | Definition | Applies to |
|---|---|---|
| Calls handled | total completed calls | all |
| Answer rate | answered / dialed | outbound |
| Avg handle time | mean call duration | all |
| Deflection rate | resolved without human transfer | inbound |
| Bookings | `outcome.booked = true` | clinic + booking agents |
| Carts recovered / revenue recovered | `outcome.recovered_cart` + value | shopify |
| Conversion (campaign) | desired outcome / dialed | campaigns |
| Opt-outs | `outcome.opt_out = true` count + rate | outbound |
| Transfers to human | escalations fired | all |
| Voicemail rate | voicemail / dialed | outbound |
| Minutes used | from `usage_ledger` | billing tie-in |

**AC:**
- Every metric filterable by date/agent/campaign/vertical.
- Numbers reconcile with `usage_ledger` (minutes) and `calls` (counts) — no separate source of truth.
- Per-agent view shows that agent's relevant subset (e.g. cart-recovery shows recovered revenue, booking shows bookings).
- Empty state when no calls yet; loads under 2s for a typical org.

---

## E. Billing — default tiers  *(placeholder, confirm before launch)*

Stripe **subscriptions + metered usage** off the append-only `usage_ledger` (DB §11). `plan_id`-driven so tiers are config, not code.

| Tier | Monthly (placeholder) | Bundled minutes | Overage / min | Numbers incl. | Notes |
|---|---|---|---|---|---|
| **Starter** | $49 | 300 | $0.18 | 1 | 1 agent live, core templates |
| **Growth** | $149 | 1,200 | $0.15 | 3 | unlimited agents, campaigns, knowledge |
| **Pro** | $399 | 4,000 | $0.12 | 10 | priority concurrency, webhook-out, whitelabel |

> ⚠️ **Placeholder numbers** — pricing not finalized. The *mechanism* is the contract; the *values* are config (Stripe prices + `subscriptions.included_minutes`). Don't hardcode amounts.

**AC:**
- Subscription created on signup/upgrade; metered minutes pushed to Stripe idempotently (unique on period+org).
- Live usage meter; **80% amber / 100% danger** alerts; overage line begins at 100%; cap behavior per plan.
- Payment failure → blocking banner; never bill from `calls.cost_usd` (that's COGS, not price).
- No call segment billed twice (`usage_ledger` idempotency key).

---

## F. Settings page  *(specced here)*  — `/settings`

Tabs:

**F.1 Org profile** — name, vertical (display, change is heavy → confirm), timezone default, default calling-hours window (feeds new agents' defaults + `can_dial()`).

**F.2 Notifications** — per-user prefs (email + in-app) for: missed call, voicemail, campaign done, billing alert, integration broken. Writes to user prefs; events land in `notifications`.

**F.3 Billing access** — view plan, usage meter, invoices, cap-alert thresholds (links to §E). Owner-only actions where relevant.

**F.4 Whitelabel (basic v1 UI — overrides PRD "out of scope")** — upload **logo** + pick **brand primary color**; applied to the console header and outbound **emails** (`orgs.branding` jsonb). Scope: cosmetic branding only — **not** a reseller/multi-brand program.

**F.5 Compliance defaults** — default calling window, opt-out language, consent source labels (read-only display of the immutable rules).

**AC:**
- Notification prefs persist per user; toggling off stops that email/in-app type.
- Whitelabel logo + color render on console + at least one transactional email; default Aurora branding if unset.
- Calling-hours default flows into new agents and the `can_dial()` hours check.
- All settings RLS-scoped to the org.

---

## G. Error & empty states standard  *(formalized)*

**Error rule (binding):** never show raw errors. Every error = **what happened + what to do + retry/contact support.** Legal-critical actions (dialing a campaign, deleting contacts) pass through a **ConfirmGate** with an explicit consequence sentence.

**Empty states (every primary list):**
| Screen | Empty message + CTA |
|---|---|
| Dashboard | Setup Checklist (the empty state *is* onboarding) |
| Agents | "Create your first agent" + template picker |
| Knowledge | "Add what your agents should know" + Add |
| Numbers | "Get a phone number" + both paths |
| Contacts | "Import contacts to begin" + import (with attestation gate) |
| Campaigns | "Create a campaign" (disabled until consented contacts exist, with tooltip) |
| Calls | "No calls yet — test-call an agent to see one here" |
| Outcomes | "No data yet" skeleton |

**Loading:** skeletons, not spinners, on tables. **Offline/failed fetch:** inline retry. **AC:** every list has explicit empty + loading + error states; no blank screens; no raw stack traces ever shown.

---

## H. Deferred / fast-follow (NOT v1, but don't architect them out)

Documented so dev leaves room — cheap to add later because the model already supports them:
- **Team members + roles** — `user_role` enum already exists (`owner/admin/ops`); v1 ships single-owner UI, multi-user invite UI is fast-follow.
- **Audit log (who changed what)** — append-only pattern already established (consent/usage ledgers); add an `audit_log` table when needed for compliance.
- **Two-way CRM/Shopify contact sync** — v1 is import/export + read-pull; bidirectional sync later.
- **Q&A-pair + paste-text knowledge** — v1 ships upload/website/integration; manual Q&A is a small add to `knowledge_sources`.
- **More verticals** — insert a `vertical_configs` row + templates; no journey rewrite.

---

## I. The non-negotiables (if nothing else, these must hold)

1. **No outbound dial without `can_dial()`=true** at dial time. (TCPA)
2. **Consent/DNC ledgers are append-only**, never mutated via API; opt-out propagates in one transaction.
3. **RLS on every tenant table** + `rls-coverage` CI green; no cross-org read ever.
4. **Secrets via `secret_ref`** (Vault/KMS), never plaintext columns.
5. **No vendor SDK imported directly** — all voice goes through `VoiceProvider`.
6. **No call billed twice**; billing computed from `usage_ledger`, never COGS.
7. **No technical jargon in the no-code UI**; power lives behind Advanced.
8. **Verticals are config, never hardcoded.**

---

*Aurora handbook — this is the master scope contract. Detailed designs: [Black Book](Aurora-BlackBook.md) · [Database Guide](database-guide.md) · [UI/UX Spec](Aurora-UIUX-Spec.md) · [User-Flow & Knowledge](Aurora-UserFlow-and-Knowledge.md) · [Agent Template Library](Aurora-AgentTemplateLibrary.md). Build against this; if it's not here, it's not v1.*
