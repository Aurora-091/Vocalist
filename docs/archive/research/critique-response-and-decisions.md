# Aurora — Red-Team Critique: Response & Decisions

> **Purpose:** a standalone record of the four-item red-team critique against the Phase-1 plan, the decision taken on each, and *why*. This is the audit trail — if a reviewer asks "did you see X coming?", the answer and the rationale live here. Three items hardened the plan; one was **consciously rejected** and is logged as an accepted risk.
>
> Companion docs: [v1 Scope Contract](Aurora-v1-Scope-and-Build-Contract.md) · [Database Guide](database-guide.md) · [Research Brief](Aurora-ElevenLabs-CAI-Research-Brief.md) · [Build Shortcuts](Aurora-Build-Shortcuts.md).

---

## Summary table

| # | Critique | Verdict | Disposition |
|---|---|---|---|
| 1 | Inbound calls bypass the spend & abuse guards | **Accepted — fixed** | Hono admission gate; no native CAI inbound binding |
| 2 | Pricing should be outcome/taxi-meter, not bundled minutes | **Rejected — accepted risk** | Bundled-min+overage stays v1; outcome pricing = Phase-2 upsell |
| 3 | Phase 1 is a generic no-code wrapper with no moat | **Accepted — fixed** | Shopify deep integration pulled into Phase 1 |
| 4 | LLM token bloat silently blows the $0.15/min floor | **Accepted — fixed** | Per-call `cost_usd`+token metering; guards meter on dollars |

---

## #1 — Inbound spend-guard bypass  *(ACCEPTED → FIXED)*

**The critique.** If we bind the inbound DID natively to the CAI agent (the "config, not code" path CAI advertises), CAI **answers the call before any of our code runs**. That means `can_spend()` and any abuse/velocity limit are never consulted on inbound. COGS is real from the first answered second, so this is (a) a direct money leak when budgets are exhausted and (b) a trivial DoS/cost-bomb vector — point a bot dialer at the number and rack up our bill.

**Decision.** **We own the DID and the front door. No native CAI number binding for inbound.**

The inbound flow becomes:
1. Caller dials our Twilio DID → Twilio POSTs `POST /webhooks/twilio/inbound` to **our Hono**.
2. Resolve `org_id` + bound `agent_id` from the called number.
3. `check_inbound_rate(org_id, to_e164, from_e164, now)` — sliding-window counter in `inbound_rate_counters` (per-org + per-caller). Over limit → TwiML decline/voicemail, log `blocked_rate`.
4. `can_spend(org_id, now)` — same guard as outbound, metered on `cost_usd`. Over budget → TwiML voicemail/"we'll call you back", log `blocked_spend`.
5. Both pass → TwiML `<Connect>`/`<Dial>` hands the **media stream** to the CAI agent endpoint. CAI runs the conversation; post-call webhook writes `calls` + `usage_ledger`.

**Why this is cheap.** It's **one webhook handler + a TwiML response**, not a media proxy — we are *not* in the audio path, so the only added latency is one signaling hop (tens of ms). Outbound is untouched: we initiate those, so we already gate (`can_dial()` + `can_spend()`) before placing the call.

**Where it lives:** Scope §J + §B (native-binding ban) + non-negotiable #11; DB Guide "Inbound admission gate" + `inbound_rate_counters` table + invariant #10; Build-Shortcuts PR 1.5.

---

## #2 — Pricing model (taxi-meter vs bundled minutes)  *(REJECTED → ACCEPTED RISK)*

**The critique.** Bundled-minutes + overage couples our price to per-minute COGS and leaves margin upside on the table. The verticalized players at $12M+ ARR price on **outcomes** (~$1.50/resolved-call), which decouples price from cost and captures the value we actually deliver. Lead with outcome/taxi-meter pricing.

**Decision — we keep bundled-minutes + overage as the primary v1 model.** Outcome pricing becomes a **Phase-2 upsell**, not the v1 foundation. This overrides the critique deliberately.

**Rationale.**
- **Shippability.** Bundled-min+overage maps directly onto the billing mechanism already specced (Scope §E, Stripe metered usage). Outcome pricing needs reliable **outcome attribution** (was this booking/cart-recovery genuinely caused by the call?) — which we won't have until the Phase-1 Shopify vertical is producing data.
- **Margin is already protected structurally.** With fix #4, spend guards meter on `cost_usd` (incl. LLM tokens). So even if a tier's bundled minutes turn out token-heavy, the guard catches real-dollar overruns — we don't bleed margin while waiting to re-price.
- **Sequencing, not refusal.** Once Phase-1 Shopify gives us cart-recovery attribution, we add a per-outcome SKU as an *upsell on top of* the subscription. Billing is architected so this bolts on (Research Brief §3 principle 4).

**Accepted risk (explicit).** We may leave pricing-power upside uncaptured in the early months, and a competitor leading with outcome pricing could anchor the market on $/result before we offer it. We judge that acceptable versus the cost of building outcome-attribution + a second billing model before we have a single paying customer. **Revisit trigger:** when ≥1 Phase-1 vertical has clean outcome-attribution data, or when a deal is lost specifically on pricing model. This is logged so it is not mistaken for an oversight.

**Where it lives:** Research Brief §3 (decision box) + §7 risk row + §8 decision #7; Build-Shortcuts §3 Phase-2 ("outcome-based pricing upsell").

---

## #3 — Phase-1 moat (generic wrapper risk)  *(ACCEPTED → FIXED)*

**The critique.** A no-code voice-agent builder on top of CAI is a **same-day bolt.new/clone** with zero defensibility and zero pricing power. If Phase 1 ships only the generic wrapper, there's nothing sticky before the pre-seed→seed gap.

**Decision.** **Pull the Shopify deep integration into Phase 1** as the lead vertical — an *Automated Cart-Recovery + Order-Modifier* agent with native Shopify tools day one:
- Tools: `lookup_order`, `cancel_order`, `apply_discount_code`, `update_address` (wired as CAI function tools).
- Trigger: **abandoned-checkout / cart webhook** → enqueue → `can_dial()` → outbound recovery call.

Data gravity from this single deep integration is what makes us sticky enough to survive the funding gap. Clinic (Cal.com + booking) and the remaining integration bags stay in **Phase 3**.

**Where it lives:** Scope §0 (table) + launch-verticals moat paragraph; DB Guide build-order Phase 1 (Shopify integration + tools = day-1 moat); Build-Shortcuts §2 item 7 + PR 1.11; Research Brief §6/§8 decision #6.

---

## #4 — Token bloat blows the $0.15/min floor  *(ACCEPTED → FIXED)*

**The critique.** The $0.15/min planning floor assumes a cheap model + tight prompts. But CAI bills a **pass-through LLM token fee on top of the voice minute**, and CAI's native RAG is **opaque** — to preserve context it can inject large segments into the prompt, spiking `tokens_in` unpredictably. Pricing math built on $0.15/min can silently go underwater.

**Decision.** Make token cost **first-class and metered on dollars, not minutes.**
- `usage_ledger` records **`tokens_in`**, **`tokens_out`**, and computed **`cost_usd`** per call segment, pulled from the CAI post-call webhook.
- `meter_kind` enum gains **`llm_tokens`** so pass-through LLM COGS is a distinct, queryable line item.
- **Spend guards meter on `cost_usd`, not minutes** — a token-heavy call counts its *real* cost against the ceiling, so `can_spend()` trips on dollars.
- A weekly eval surfaces real $/min vs. the $0.15 assumption; if RAG context bloat is the driver, that's the evidence that justifies revisiting self-hosted pgvector in Phase 4.

**Net:** $0.15/min is now explicitly a **pricing floor for tier math**, while the **guard enforces reality**. Token bloat can no longer silently erode unit economics.

**Where it lives:** DB Guide `usage_ledger` (`tokens_in/out`, `cost_usd`) + `meter_kind` enum + token-tracking note + invariant #11; Scope non-negotiable #12; Research Brief §2 caveat + §7 risk row + §8 decision #4.

---

## What did *not* change

- ElevenLabs CAI remains the Phase-1 runtime; Vapi stays compiled-but-unregistered behind the `VoiceProvider` seam.
- KB stays CAI-native RAG; no self-hosted pgvector in Phase 1 (`knowledge_sources` = thin mirror with `cai_doc_id`).
- Compliance core (`can_dial()`, consent/DNC append-only ledgers, calling-hours) unchanged — still Tier-1.
- Billing tiers ($99 / $299 / $799, overage ≈ 2× COGS) unchanged in shape; only the metering basis (now `cost_usd`) hardened.

---

*This document is the critique audit trail. If a decision here is reversed, update the "Revisit trigger" lines and note the date + reason.*
