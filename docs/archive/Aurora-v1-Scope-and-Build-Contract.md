# Aurora — v1 Scope & Build Contract

> **The single source of truth for what v1 is.** Read this first. It is the *map*, not a duplicate — each feature links to the detailed doc that specs it. If a feature isn't here, it isn't in v1. If it's here, it ships with the acceptance criteria below. This exists so engineering finds **no loopholes mid-build**.

**Launch verticals:** Shopify merchant · Clinic (appointment SMB). Verticals are **config rows** (`vertical_configs`), never hardcoded — model is tenant-ready, only these two ship in v1 UI.

**Phase-1 moat (red-team item #3):** We do **not** ship a generic no-code voice-agent wrapper — that's a same-day bolt.new clone with zero pricing power. **One deep vertical leads Phase 1: Shopify** — an *Automated Cart-Recovery + Order-Modifier* agent with **native Shopify tools day one** (`lookup_order`, `cancel_order`, `apply_discount_code`, `update_address`) + abandoned-checkout trigger. Data gravity from this single deep integration is what makes us sticky enough to survive pre-seed→seed. Clinic + the rest of the integration bags follow in Phase 3.

**Stack (binding):** Node + Express + CommonJS for v1 · Supabase (Postgres/RLS/Auth/Realtime/Storage) · **ElevenLabs Conversational AI (Phase-1 voice runtime + native RAG + Twilio telephony)** behind a `VoiceProvider` seam · **Vapi kept compiled behind the seam but inactive** (Phase-4 swap, ~200-line migration) → Pipecat self-host (Phase 4) · Stripe (subscriptions + metered) · Twilio (numbers + SMS, per-tenant subaccount).

**Voice runtime decision (binding):** Phase 1 ships on **ElevenLabs CAI** — it provides agent CRUD, 5k+ voices/31 langs, **native low-latency RAG** (we do not run our own pgvector in Phase 1), function-calling tools, native Twilio inbound/outbound, batch calls, post-call webhooks, and a shadcn React component lib. We build the thin orchestration + integration moat on top, not the runtime. Apply for the **ElevenLabs Startup Grant** (33M chars / 680 hrs / ~$4K / 12 mo, <25 employees) **before workstream 1**.

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
| 7 | Knowledge Base (PDF / DOCX / URL / text · **CAI-native RAG** · org-wide, subscribe; our DB is a thin mirror) | ✅ | User-Flow §5, DB §3.1 | specced |
| 7b | **Spend guards** (meter every minute + hard cost ceiling from call #1; Twilio UsageTrigger backstop) | ✅ | **this doc §E.1**, DB §3.1 | **specced here** |
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

**7. Knowledge Base (CAI-native RAG)**
- Sources: PDF/DOCX upload, website URL, raw text → pushed to **ElevenLabs CAI Knowledge Base API**; CAI owns chunking/embeddings/RAG. Our `knowledge_sources` is a thin mirror (title, status, `cai_doc_id`); org-wide; agents subscribe via `agent_knowledge` (we attach the subscribed `cai_doc_id`s to the CAI agent).
- AC: an agent is configured with **only** its subscribed sources' `cai_doc_id`s; tenant library is RLS-scoped (no cross-org); status lifecycle processing→ready/error shown; re-sync/delete propagates to CAI; agent defers to human when KB has no answer (CAI RAG behavior + system prompt guardrail). **No pgvector / `knowledge_chunks` in Phase 1.**

**7b. Spend guards** — see §E.1.

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
- Inbound DID is owned by **us** (Twilio), not bound natively to CAI. Twilio webhook hits **our Hono** first → admission gate (`check_inbound_rate()` + `can_spend()`) → on pass, return TwiML that hands off to the CAI agent; on fail, TwiML plays a graceful busy/voicemail. Then call routes to the bound agent's playbook; tools fire to integrations; recording + transcript + outcome persisted. See **§J**.
- AC: a test inbound call answered by the right agent **only after** the Hono admission gate passes; a rate-/spend-blocked inbound never reaches CAI and is logged with reason; transcript + recording viewable; outcome logged.

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
- ❌ Self-hosted voice runtime (Pipecat) — Phase 4; v1 is **ElevenLabs CAI** behind the seam (Vapi kept inactive behind the same seam).
- ❌ **Self-hosted pgvector RAG** — CAI owns RAG in Phase 1. `knowledge_chunks`/`vector` extension deferred to Phase 4 *only if* CAI RAG limits bite.
- ❌ Third+ verticals in the UI (model is ready; UI ships Shopify + Clinic only).
- ❌ **Native CAI number binding for inbound** — inbound MUST pass our Hono admission gate first (see §J). Native binding is the bug, not the feature.

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

## E. Billing — default tiers  *(COGS-real placeholders, confirm before launch)*

Stripe **subscriptions + metered usage** off the append-only `usage_ledger` (DB §11). `plan_id`-driven so tiers are config, not code.

**True COGS floor ≈ $0.15/min** = CAI ~$0.10 (voice/min) + ~$0.02 (pass-through LLM) + ~$0.014 (Twilio) + headroom. Tiers price *above* this; **overage is the margin engine** (priced ~2× COGS).

| Tier | Monthly | Bundled min | Eff. $/min | Overage $/min | Numbers incl. | Notes |
|---|---|---|---|---|---|---|
| **Starter** | $99 | 400 | $0.25 | **$0.30** | 1 | 1 agent live, core templates |
| **Growth** | $299 | 1,500 | $0.20 | **$0.32** | 3 | unlimited agents, campaigns, knowledge |
| **Scale** | $799 | 5,000 | $0.16 | **$0.35** | 10 | priority concurrency, webhook-out, whitelabel |

> ⚠️ **Placeholder numbers** — the *mechanism* is the contract; *values* are config (Stripe prices mirrored into `subscriptions.included_minutes`/`included_numbers`/`overage_rate_usd`). Don't hardcode amounts.
> 💡 **Grant arbitrage:** during the ElevenLabs grant, CAI COGS ≈ $0 for the first ~25 customer-months → near-pure margin pre-seed. Bank it; don't discount. Outcome pricing (per-booking / per-recovered-cart) is the **Phase-2 upsell** that decouples price from per-minute COGS (bundled-min+overage stays the v1 primary — see Critique-Response doc, item #2).

**AC:**
- Subscription created on signup/upgrade; metered minutes pushed to Stripe idempotently (unique on period+org).
- Live usage meter; **80% amber / 100% danger** alerts; overage begins at 100%; cap behavior per plan.
- Payment failure → blocking banner; never bill from `calls.cost_usd` (that's COGS, not price).
- No call segment billed twice (`usage_ledger` idempotency key).

### E.1 Spend guards  *(Phase 1 — meter + hard cap from call #1)*

Billing (Stripe) is Phase 2, but the grant only zeroes **CAI** COGS — **Twilio + LLM fees are real money from the first call.** So metering + a hard ceiling ship in **Phase 1**, independent of billing.

- **Meter:** every call segment's COGS inserts into `usage_ledger` on the call-end webhook (idempotent) and increments `spend_counters` (DB §3.1).
- **Gate:** `can_spend(org, scope, scope_id, now)` runs alongside `can_dial()` before *every* call. False → call not placed.
- **Guards:** per-org (and optional per-agent/per-campaign) daily/monthly `limit_usd` in `spend_guards`. 80% → `notifications` (billing); 100% → pause the scope (campaign→`paused`, agent stops dialing).
- **Backstop:** a **Twilio UsageTrigger** on the subaccount as a provider-side hard stop if our worker is wedged.

**AC:**
- No call is placed when its scope is at/over the ceiling.
- A runaway loop cannot exceed the configured daily cap (tested: fire N calls, assert spend ≤ limit + one in-flight).
- 80% alert fires once; 100% pause is immediate and idempotent.
- Counters reconcile with `usage_ledger` nightly (drift pages a human).

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
5. **No vendor SDK imported directly** — all voice goes through `VoiceProvider`. Phase 1 = **ElevenLabs CAI** registered; **Vapi compiled but NOT registered** in the factory.
6. **No call billed twice**; billing computed from `usage_ledger`, never COGS.
7. **No technical jargon in the no-code UI**; power lives behind Advanced.
8. **Verticals are config, never hardcoded.**
9. **No call placed without `can_spend()`=true** at call time — COGS is real from call #1 even on the grant. (Spend guard)
10. **KB is CAI-native** in Phase 1 — no self-hosted embeddings; agents are scoped to their subscribed `cai_doc_id`s only.
11. **Inbound passes our Hono admission gate first** — `check_inbound_rate()` + `can_spend()` before any TwiML handoff to CAI. **No native CAI number binding for inbound, ever.** (§J)
12. **Spend guards meter on `cost_usd`, not minutes** — `usage_ledger` records `tokens_in`/`tokens_out`/`cost_usd` per call; LLM/token COGS (`meter_kind = llm_tokens`) is first-class, so token bloat can't silently blow the unit economics.


---

## J. Inbound admission flow  *(binding — red-team item #1)*

**Why:** native CAI number binding answers inbound calls **before** any of our guards run — a free bypass of `can_spend()` and any abuse rate-limit. COGS is real from the first answered second, so an unmetered inbound path is a direct money leak and a DoS vector. We therefore **own the DID and the front door.**

**Flow (every inbound call):**
1. Caller dials our Twilio DID → Twilio POSTs the inbound webhook to **our Hono** (`POST /webhooks/twilio/inbound`).
2. Hono resolves `org_id` + bound `agent_id` from the called number.
3. **`check_inbound_rate(org_id, caller_e164, now)`** — sliding-window counter in `inbound_rate_counters` (per-org and per-caller). Over limit → return TwiML that politely declines / drops to voicemail; log `blocked_rate`.
4. **`can_spend(org_id, now)`** — same spend guard as outbound, metered on `cost_usd`. Over budget / grant exhausted → TwiML voicemail or "we'll call you back" message; log `blocked_spend`.
5. Both pass → return **`<Connect>`/`<Dial>` TwiML that hands the media to the CAI agent's SIP/stream endpoint**. CAI runs the playbook; tools fire; post-call webhook lands back on Hono → writes `calls` + `usage_ledger` (with `tokens_in/out`, `cost_usd`).

**Hard rules:**
- **No native CAI number binding for inbound.** The DID's voice webhook always points at Hono. (See §B out-of-scope.)
- Admission decision is logged either way (admit / `blocked_rate` / `blocked_spend`) so abuse and budget events are auditable.
- Outbound is unaffected — we already gate (`can_dial()` + `can_spend()`) **before** initiating, so outbound needs no TwiML front door.
- TwiML handoff adds one signaling hop (~tens of ms), not a media proxy — we are **not** in the audio path, so latency cost is negligible.

---

*Aurora handbook — this is the master scope contract. Detailed designs: [Black Book](Aurora-BlackBook.md) · [Database Guide](database-guide.md) · [UI/UX Spec](Aurora-UIUX-Spec.md) · [User-Flow & Knowledge](Aurora-UserFlow-and-Knowledge.md) · [Agent Template Library](Aurora-AgentTemplateLibrary.md) · [Critique-Response & Decisions](Aurora-Critique-Response-and-Decisions.md). Build against this; if it's not here, it's not v1.*
