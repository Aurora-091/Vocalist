# Aurora — ElevenLabs CAI Research Brief

> **Purpose:** the evidence + decisions behind the Phase-1 pivot to ElevenLabs Conversational AI (CAI). Read alongside the [v1 Scope Contract](Aurora-v1-Scope-and-Build-Contract.md) and [Database Guide](database-guide.md). Pre-seed lens: ship fast, spend little, don't reinvent the wheel.

**TL;DR**
- CAI is the whole agent runtime, not just TTS — it gives us agent CRUD, 5k+ voices/31 langs, **native low-latency RAG**, function-calling tools, **native Twilio** inbound/outbound, batch calls, post-call webhooks, and a shadcn React component lib.
- We build the **thin orchestration + integration moat**, not the runtime.
- True COGS ≈ **$0.15/min** (CAI voice + pass-through LLM + Twilio). The grant zeroes the CAI slice for ~25 customer-months.
- **Hidden cost:** CAI bills pass-through LLM token fees on top of the per-minute rate. Use a cheap model or BYO LLM key to control it.
- Stack other startup credits (AWS / GCP / Twilio) to cover the rest of infra COGS pre-seed.

---

## 1. What CAI gives us natively (don't rebuild these)

Source: ElevenLabs Agents docs (`elevenlabs.io/docs/eleven-agents/overview`).

| Capability | CAI native | Our build |
|---|---|---|
| Agent CRUD (name/system-prompt/voice/lang) | ✅ API + dashboard | thin DB mirror (`agents.provider_ref` = CAI agent id) + our no-code UI |
| Voice library | ✅ 5k+ voices, 31 languages | surface a **curated subset** (~10–15) so users aren't paralyzed |
| **Knowledge Base + RAG** | ✅ **native, low-latency RAG**; upload PDF/DOCX/URL/text, toggle RAG, set max chunks + embedding model | **nothing** — `knowledge_sources` is a thin mirror holding `cai_doc_id`; no pgvector |
| Tools / function calling | ✅ client tools + server tools | our tool endpoints (Shopify lookup_order, Cal.com book_appointment, …) — Phase 3 |
| Telephony | ✅ **native Twilio** integration, inbound + outbound, import existing numbers; also SIP trunk | webhook wiring + number↔agent binding only |
| Batch outbound calls | ✅ native batch-calls API | dialer trigger + spend guard wrap it |
| Personalization | ✅ dynamic variables + per-conversation overrides | pass `{first_name}` etc. from our contact record |
| Transcripts + recordings | ✅ post-call webhooks | store the pointer in `calls` |
| Analytics / eval / testing | ✅ conversation analysis, evals, real-time monitor, OpenTelemetry | our outcomes rollup reads from webhooks |
| UI components | ✅ **shadcn-based React component lib** for audio/agent apps | drop into AgentNew / call viewer |
| LLM choice | ✅ supported LLMs **or bring-your-own custom model**; LLM cascading | pick a cheap default; expose BYO later |
| Workflows | ✅ visual workflow builder (multi-step) | out of v1 (we stay no-code-fields; not building flows) |

**Net effect on the plan:** two subsystems we previously planned are **deleted from Phase 1** — our custom pgvector RAG (CAI owns it) and most custom telephony glue (CAI↔Twilio is native).

---

## 2. Costing — the real per-minute math

| Component | Rate | Notes |
|---|---|---|
| CAI conversational minute | **~$0.10/min** (Creator/Pro); **$0.08/min** (Business annual); overage $0.096–$0.12 | Source: ElevenLabs pricing + "we cut our pricing" blog |
| **Pass-through LLM token fee** | **~$0.01–0.05+/min** | ⚠️ billed on top of the voice minute; depends on model + prompt length. Reddit r/ElevenLabs confirms this is separate. |
| Twilio voice (US) | **~$0.013–0.014/min** + ~$1–2/mo per number | separate vendor, separate bill |
| **Planning floor** | **≈ $0.15/min** | use this for tier math |

**Levers to cut COGS:**
- Use a cheaper LLM (GPT-4o-mini / Gemini Flash) via CAI's model picker, or **BYO LLM key** (custom models + LLM cascading supported).
- Keep system prompts tight (token count drives the pass-through fee).
- Annual Business plan drops voice to $0.08/min once volume justifies it.

---

## 3. Pricing strategy

Market range for AI voice: **$0.05–$1.50/min** depending on packaging. Selling raw minutes at cost is a trap. Package value, not minutes.

**Model: subscription + bundled minutes + overage** (keeps our existing §E mechanism; numbers reset to COGS-real):

| Tier | $/mo | Bundled min | Eff. $/min | Overage $/min | Numbers |
|---|---|---|---|---|---|
| Starter | $99 | 400 | $0.25 | $0.30 | 1 |
| Growth | $299 | 1,500 | $0.20 | $0.32 | 3 |
| Scale | $799 | 5,000 | $0.16 | $0.35 | 10 |

**Principles:**
1. **Overage is the margin engine** — price ~2× COGS ($0.30–0.35 vs $0.15). Bundled minutes are the hook; overage is profit.
2. **Grant arbitrage** — CAI COGS ≈ $0 for the first ~25 customer-months. Pre-seed revenue is near-pure margin. Bank it; do not discount to win logos.
3. **Hard spend guards from call #1** (DB §3.1 `spend_guards`/`can_spend()`) — telephony + LLM are real money even on the grant; a runaway loop is a real bill.
4. **Outcome pricing is the Phase-4 upsell** — per-booking / per-recovered-cart decouples price from per-minute COGS (the $12M-ARR verticalized players price ~$1.50/resolved-call). Don't build it in v1, but architect billing so it's addable.

---

## 4. The ElevenLabs Startup Grant

Source: `elevenlabs.io/blog/elevenlabs-startup-grants-just-got-bigger…` + `/grants-application`.

- **What:** 12 months free, **33M credits / ~680 hrs Conversational AI / ~$4K value**.
- **Who:** startups/companies with **< 25 employees**, anywhere.
- **Trade:** display the "ElevenLabs Grants" logo on the Aurora site for 12 months. No equity, no usage caps beyond the 33M chars.
- **One grant per company.** Application asks how your product incorporates AI voices — answer concretely (we are a voice-agent SaaS for SMBs).
- **Action:** apply **before workstream 1**; also email `sales@elevenlabs.io` to validate building a **SaaS on top of their API** (resale/multi-tenant) is within ToS. Do this before writing dialer code.

---

## 5. Other startup credits to stack (beyond ElevenLabs)

| Program | Value | How to get it | Why it matters to Aurora |
|---|---|---|---|
| **AWS Activate** | up to **$200K** (+ GenAI tier extra) | $1K founder tier self-serve; big tiers need accelerator/VC referral | infra (if any AWS), GenAI credits |
| **Google for Startups Cloud** | up to **$200K** ($350K AI-first) | apply; we qualify as AI-first → aim high | infra + AI training |
| **Twilio Startup Program** (via Segment/Twilio for Startups) | Twilio credits | apply | **directly offsets our telephony COGS** — highest leverage |
| **Stripe** partner/startup discounts | fee discounts | via accelerator partners | we bill on Stripe |
| **Supabase** startup credits | credits | via accelerator partners | our DB/auth/storage layer |

Stacking Twilio + a cloud program + ElevenLabs can cover most infra COGS through pre-seed. **Twilio credits are the single most relevant** since telephony is the one COGS the ElevenLabs grant does *not* cover.

---

## 6. What competitors are doing (validation of the approach)

- Agencies are **white-labeling CAI directly** for clients (Reddit r/automation) — confirms CAI is production-grade for resale.
- Verticalized voice-AI players reach **$12M+ ARR** pricing at **~$1.50/resolved-call** for 250+ enterprise brands — confirms outcome-pricing upside and that the **moat is the vertical/integration layer, not the runtime**.
- The repeatable winning pattern: **thin orchestration + integration moat on top of CAI/Retell/Vapi**, not rebuilding STT/TTS/LLM glue.

**Implication for Aurora:** our defensibility is Phase 3 (Shopify + Clinic integration bags + compliance/consent core), *not* the voice runtime. Spend engineering there, not on reinventing RAG or telephony.

---

## 7. Risks / watch-items

| Risk | Mitigation |
|---|---|
| Pass-through LLM fees balloon unit cost | cheap default model + tight prompts + BYO LLM key option; monitor per-call COGS in `usage_ledger` |
| CAI RAG limits (size caps / recall) bite | seam to re-introduce self-hosted pgvector documented; **deferred to Phase 4**, not removed conceptually |
| CAI ToS on SaaS-on-API / resale | email `sales@elevenlabs.io` to validate **before** building |
| Vendor lock-in to CAI | `VoiceProvider` seam holds; Vapi stays compiled behind it; ~200-line migration script spec'd for Phase 4 |
| Grant runs out / pricing changes | tiers are config; overage already priced for margin without the grant; Twilio credits stacked |
| Two-party recording consent (legal) | recording = opt-in + disclosed per tenant (compliance decision, pending your call) |

---

## 8. Decisions locked from this research

1. **Phase-1 runtime = ElevenLabs CAI**; Vapi compiled but **not registered** in the factory.
2. **KB = CAI-native RAG**; gut pgvector from Phase 1 (`knowledge_sources` = thin mirror with `cai_doc_id`).
3. **Billing tiers reset** to COGS-real ($0.15/min floor; Starter $99 / Growth $299 / Scale $799; overage = ~2× COGS).
4. **Spend guards ship Phase 1** (`spend_guards`/`spend_counters`/`can_spend()` + Twilio UsageTrigger backstop).
5. **Apply for the ElevenLabs grant before workstream 1**; email sales to validate SaaS-on-API.
6. **Stack Twilio + cloud startup credits** to cover non-CAI COGS.

*Open (not decided here):* default voice when unset, blank-opening-message behavior, KB size caps per tier, curated-vs-full voice library, recording always-on vs opt-in. See Scope §14 open questions.
