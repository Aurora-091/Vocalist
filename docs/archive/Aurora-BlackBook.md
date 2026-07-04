# Aurora — Project Black Book

> **Audience:** Investors, leadership, engineering leads.
> **Last updated:** June 2026
> **Status:** Pre-seed / pre-revenue. Architecture locked. MVP functional.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem & Market Opportunity](#2-problem--market-opportunity)
3. [Solution — What Aurora Does](#3-solution--what-aurora-does)
4. [How It Works (Product Walkthrough)](#4-how-it-works-product-walkthrough)
5. [Business Model & Pricing](#5-business-model--pricing)
6. [Unit Economics & COGS](#6-unit-economics--cogs)
7. [Go-to-Market Strategy](#7-go-to-market-strategy)
8. [Competitive Landscape](#8-competitive-landscape)
9. [Technical Architecture](#9-technical-architecture)
10. [Database & Data Model](#10-database--data-model)
11. [Security, Compliance & Legal](#11-security-compliance--legal)
12. [Team & Execution](#12-team--execution)
13. [Roadmap & Milestones](#13-roadmap--milestones)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Appendix: Developer Reference](#appendix-developer-reference)

---

## 1. Executive Summary

**Aurora** is a no-code voice AI platform for small and medium businesses. An SMB owner connects their store, calendar, or CRM — and gets a production-grade AI phone agent live in under 10 minutes. No code. No telephony expertise. No compliance headaches.

The agent handles **inbound** calls (customer service, appointments, order inquiries), places **outbound** calls (cart recovery, appointment reminders, follow-ups), and runs **bulk scheduled voice campaigns** — all while enforcing US TCPA compliance automatically.

**Revenue model:** SaaS subscription + metered voice minutes + outcome-based pricing (Phase 2).

**Why now:**
- Voice AI quality crossed the "indistinguishable from human" threshold in 2025
- 85% of SMBs still send missed calls to voicemail — each missed call = $200+ average lost revenue
- No product today combines inbound + outbound + campaigns + Shopify/CRM integration at SMB price points

**Ask:** Pre-seed round to fund 6 months of execution through paid pilot launch.

---

## 2. Problem & Market Opportunity

### The Pain

| Who | Problem | Current "Solution" |
|-----|---------|-------------------|
| Shopify merchants | Miss 40-60% of inbound calls; abandoned carts never recovered by phone | Hire staff ($3-5K/mo) or lose the revenue |
| Clinics & service businesses | No-shows cost $150+ each; phone tag for scheduling wastes staff hours | Receptionist services ($800-2K/mo), limited hours |
| Any SMB with outbound needs | TCPA compliance is terrifying; dialers are enterprise-priced ($500+/seat) | Don't do outbound at all |

### Market Size

| Segment | TAM | SAM (US, addressable) |
|---------|-----|----------------------|
| US SMBs with phone-based revenue | ~6M businesses | ~2M (stores, clinics, services) |
| Voice AI market (2025-2030 CAGR 23%) | $12B by 2030 | $2-3B SMB segment |
| Average contract value (Aurora) | - | $200-400/mo (blended) |
| SAM revenue opportunity | - | $4-10B annually |

### The Gap

```
                        Inbound    Outbound    Campaigns    SMB Price    No-code
                        ────────   ────────    ─────────    ─────────    ───────
Vapi / Retell / Bland     -          -            -            -           -
  (infra — sell engines, not outcomes)

AI receptionists          Y          -            -            Y           Y
  (Smith.ai, Ruby, etc.)

Enterprise dialers        -          Y            Y            -           -
  (Five9, Dialpad AI)

Aurora                    Y          Y            Y            Y           Y
```

Aurora occupies the only product position that combines all five.

---

## 3. Solution — What Aurora Does

### For the Merchant (Maya, non-technical)

1. **Sign up** — email/password, pick your vertical (Shopify, Clinic, Service)
2. **Connect your store** — OAuth to Shopify (or Calendar, CRM)
3. **Pick an agent template** — "Cart Recovery Agent", "Appointment Booker", "Order Support"
4. **Get a phone number** — one click, Aurora provisions a local/toll-free number
5. **Go live** — agent answers inbound calls and runs outbound campaigns

Time to live agent: **under 10 minutes**.

### Core Capabilities

| Capability | Description |
|-----------|-------------|
| **Inbound AI agent** | Answers every call 24/7. Looks up orders, books appointments, escalates to humans when needed. |
| **Outbound triggered calls** | Abandoned cart? Missed appointment? Aurora calls the customer within your configured window. |
| **Bulk voice campaigns** | Upload a list or pick a CRM segment. Aurora dials them all within calling hours, respects consent, retries on no-answer. |
| **Native integrations** | Shopify (order lookup, cancel, discount, address update), Google Calendar, Cal.com, CRM, Zapier |
| **Knowledge base** | Upload PDFs, paste URLs — your agent learns your business. No vector DB management needed. |
| **Compliance engine** | TCPA consent tracking, DNC enforcement, calling-hours gates. All automatic. |
| **Outcomes dashboard** | See what your agents accomplished: carts recovered, appointments booked, calls deflected. |
| **Live campaign monitor** | Watch campaign progress in real-time. Pause/stop instantly. |

---

## 4. How It Works (Product Walkthrough)

### User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│  SIGN UP  →  PICK VERTICAL  →  CONNECT STORE  →  CREATE AGENT      │
│                                                                       │
│  GET NUMBER  →  TEST CALL  →  GO LIVE  →  MONITOR OUTCOMES          │
└─────────────────────────────────────────────────────────────────────┘
```

### Inbound Call Flow

```
Customer calls your Aurora number
    ↓
Aurora admission gate (rate check + budget check)
    ↓  passes
AI agent answers, greets by name if recognized
    ↓
Agent runs playbook:
  • Looks up their Shopify order
  • Answers questions from knowledge base
  • Books appointment via calendar API
  • Applies discount code if authorized
    ↓
Call ends → outcome logged → recording + transcript saved
    ↓
Merchant sees result in dashboard instantly (real-time)
```

### Outbound Campaign Flow

```
Merchant creates campaign:
  1. Pick audience (CRM segment, Shopify buyers, CSV upload)
  2. Choose agent (cart recovery, reminder, promo)
  3. Set schedule (window, timezone, concurrency)
  4. Review compliance (consent counts, DNC exclusions)
  5. Launch
    ↓
Aurora's campaign engine:
  • Respects calling hours (9am-7pm local)
  • Checks consent + DNC before EVERY dial
  • Dials up to N concurrent calls
  • Retries on no-answer (configurable)
  • Drops voicemail if configured
  • Stops immediately on opt-out ("stop calling me")
    ↓
Real-time: merchant watches progress
Post-campaign: outcomes report (converted, voicemail, opted-out)
```

### The Compliance Gate (Non-Negotiable)

Every single outbound dial passes through `can_dial()`:

```
can_dial(org, phone_number, current_time) =
    consent_granted = TRUE
    AND not_on_DNC_list = TRUE
    AND within_calling_hours = TRUE
    AND budget_available = TRUE
```

If any condition fails, the number is **never dialed** — logged as suppressed with the reason. This is not configurable. It cannot be bypassed. It is the legal foundation of the product.

---

## 5. Business Model & Pricing

### Revenue Streams

| Stream | Type | Timing |
|--------|------|--------|
| **Subscription** | Monthly SaaS | v1 (launch) |
| **Metered usage** | Per-minute overage | v1 (launch) |
| **Outcome pricing** | Per-booking / per-recovered-cart | Phase 4 upsell |
| **Agency / whitelabel** | Pooled multi-tenant | Phase 3 |

### US / EU — Bundled (Twilio)

| | Starter | Growth | Scale |
|---|---|---|---|
| **Price/mo** | $79 | $249 | $699 |
| **Bundled Minutes** | 300 | 1,200 | 4,000 |
| **Overage/min** | $0.20 | $0.18 | $0.16 |
| **Phone Numbers** | 1 | 3 | 10 |
| **Extra Numbers** | $2/mo | $2/mo | $1.50/mo |
| **Agents** | 1 | 5 | Unlimited |
| **Campaigns** | — | Yes | Yes |
| **Shopify** | Yes | Yes | Yes |
| **Clinic Vertical** | — | Yes | Yes |
| **Whitelabel** | — | — | Yes |
| **Support** | Email | Priority | Dedicated |

### US / EU — BYO Twilio

| | Starter | Growth | Scale |
|---|---|---|---|
| **Price/mo** | $59 | $199 | $549 |
| **Bundled Minutes** | 300 | 1,200 | 4,000 |
| **Overage/min** | $0.18 | $0.16 | $0.14 |
| **Phone Numbers** | Customer owns | Customer owns | Customer owns |
| **Agents** | 1 | 5 | Unlimited |

BYO saving: $20/mo Starter, $50/mo Growth, $150/mo Scale. Customer pays Twilio directly.

### India — Bundled (Plivo) — Phase 3

| | Starter | Growth | Scale |
|---|---|---|---|
| **Price/mo** | Rs.1,999 | Rs.4,999 | Rs.12,999 |
| **Bundled Minutes** | 300 | 1,200 | 4,000 |
| **Overage/min** | Rs.18 | Rs.16 | Rs.14 |
| **Phone Numbers** | 1 (140-series) | 3 (140-series) | 10 (140-series) |
| **Compliance** | TRAI + DPDP native | TRAI + DPDP native | TRAI + DPDP native |

### India — BYO (Plivo or Exotel) — Phase 3

| | Starter | Growth | Scale |
|---|---|---|---|
| **Price/mo** | Rs.1,299 | Rs.3,999 | Rs.9,999 |
| **Bundled Minutes** | 300 | 1,200 | 4,000 |
| **Overage/min** | Rs.15 | Rs.13 | Rs.11 |
| **Phone Numbers** | Customer owns | Customer owns | Customer owns |

BYO saving: Rs.700/mo Starter, Rs.1,000/mo Growth, Rs.3,000/mo Scale.

### Agency / Whitelabel — Both Markets

| | India | US / EU |
|---|---|---|
| **Price/mo** | Rs.24,999 | $299 |
| **Client Orgs** | Up to 10 | Up to 10 |
| **Pooled Minutes** | 15,000 | 15,000 |
| **Overage/min** | Rs.12 | $0.14 |
| **Whitelabel** | Full | Full |
| **BYO per client** | Yes | Yes |

### Free Trial — All Markets

| | Detail |
|---|---|
| **Duration** | 14 days |
| **Minutes** | 25 free |
| **Agents** | 1 |
| **Numbers** | 1 |
| **Credit card** | Not required to start; required for outbound campaigns |
| **Telephony** | Aurora bundled (Twilio US / Plivo India) |

### Outcome Pricing — Phase 4 Upsell

Meters registered in Stripe from Phase 2. Activated when attribution is clean.

| Event | India | US / EU |
|---|---|---|
| Per recovered cart | Rs.25 | $0.50 |
| Per appointment booked | Rs.15 | $0.30 |
| **Monthly cap** | 2x subscription | 2x subscription |

### Why This Pricing Works

- **Anchored to the alternative:** a part-time receptionist costs $1,500-3,000/mo
- **Overage is the margin engine:** heavy users pay more, margin expands naturally
- **Low entry, natural expansion:** $79 gets them started; success drives volume and upgrade
- **No per-seat:** SMB owners hate per-seat; they want one number that works
- **BYO discount** rewards technical customers willing to manage their own telephony

---

## 6. Unit Economics & COGS

### Per-Minute Cost Breakdown

| Component | Cost/min | Provider |
|-----------|----------|----------|
| Voice AI runtime (ElevenLabs CAI) | ~$0.10 | ElevenLabs |
| LLM inference (pass-through) | ~$0.02 | OpenAI via ElevenLabs |
| Telephony — US (Twilio) | ~$0.014 | Twilio |
| Telephony — India (Plivo) | ~$0.006 | Plivo |
| Infrastructure (Supabase, hosting) | ~$0.005 | Supabase + Railway |
| **Total COGS (US)** | **~$0.14/min** | |
| **Total COGS (India)** | **~$0.13/min** | |

### Gross Margin Summary

| Market | Mode | Revenue/min | Telephony COGS | ElevenLabs COGS | Total COGS | Margin |
|---|---|---|---|---|---|---|
| US/EU | Bundled Starter | $0.26 | $0.014 | ~$0.10 | ~$0.114 | ~56% |
| US/EU | Bundled Growth | $0.21 | $0.014 | ~$0.10 | ~$0.114 | ~46% |
| US/EU | BYO Starter | $0.20 | $0 | ~$0.10 | ~$0.10 | ~50% |
| India | Bundled Starter | ~$0.08 | ~$0.006 | ~$0.10 | ~$0.106 | Negative |
| India | BYO Starter | ~$0.06 | $0 | ~$0.10 | ~$0.10 | Thin |

**US/EU blended gross margin target: 50-60%** (overage-heavy usage skews positive).

### India Margin Problem — Honest Assessment

India margins are negative at current ElevenLabs pricing. Three fixes:

**Fix 1 — ElevenLabs startup grant (applied):** 33M characters free zeros voice COGS for ~6-8 months. This is the India launch window.

**Fix 2 — India = BYO-only until grant:** Never offer bundled telephony in India until grant approved. Drops COGS to ElevenLabs only. Thin but survivable.

**Fix 3 — Phase 4 self-host:** Pipecat self-hosting drops COGS to ~$0.02-0.03/min. India margins flip to 60%+.

### ElevenLabs Startup Grant

Applied for and pending: **33M characters / ~680 hours / ~$4,000 value / 12 months**.
During grant period, CAI COGS drops to ~$0 → gross margin jumps to **85%+** on all tiers.
Strategy: **do not discount during grant — bank the margin for runway extension.**

### Recommended Launch Sequence

| Phase | Market | Mode | When |
|---|---|---|---|
| Phase 1-2 | US/EU | Bundled Twilio | Now |
| Phase 3 | India | BYO Plivo or Exotel only | India launch |
| Phase 3 | India | Bundled Plivo | Only after ElevenLabs grant approved |
| Phase 4 | India | Bundled + self-hosted voice | When minutes > 10K/mo India |

### Path to 70%+ Gross Margin (Phase 4)

Swap to self-hosted voice stack (Pipecat + Deepgram + OpenAI + ElevenLabs TTS direct):
- COGS drops from ~$0.14/min to ~$0.06/min
- Gross margin at Growth tier: $0.21 revenue vs $0.06 cost = **71%**
- Requires 1-2 engineers, ~6 weeks, using the existing `VoiceProvider` abstraction (no app rewrite)

---

## 7. Go-to-Market Strategy

### Phase 1: Shopify Deep Vertical (Now)

**Why Shopify first:**
- Clear, measurable ROI (recovered cart revenue is trackable to the dollar)
- Merchant persona is non-technical (validates no-code positioning)
- Shopify app store is a distribution channel (organic discovery)
- Cart abandonment is a known, felt problem — no education needed

**Distribution channels:**
1. Shopify App Store listing (free tier for discovery → paid conversion)
2. Shopify merchant communities (Reddit, Facebook groups, Twitter/X)
3. Direct outreach to Shopify Plus merchants (high-ACV)
4. Content marketing: "How to recover abandoned carts with voice AI"
5. Partner referrals (Shopify agencies, freelance store builders)

### Phase 2: Clinic/Service Expansion

**When:** After 50 paid Shopify merchants and proven retention.

**Why clinics:**
- No-shows cost $150+ each — ROI is immediate and obvious
- Recurring appointment cadence = high minute usage = good LTV
- Different persona validates platform generality

### Phase 3: Horizontal + Enterprise

- Additional verticals (real estate, insurance, home services)
- Whitelabel/reseller program for agencies
- Enterprise tier with custom SLAs

### Key Metrics to Track

| Metric | Target (6 months) |
|--------|-------------------|
| Signed up merchants | 200+ |
| Paid (Starter+) | 50+ |
| Monthly revenue | $15K+ MRR |
| Retention (30-day) | >80% |
| NPS | >40 |
| Time to first live call | <10 minutes |

---

## 8. Competitive Landscape

### Direct Competitors

| Company | Positioning | Weakness vs Aurora |
|---------|------------|-------------------|
| **Smith.ai** | AI + human receptionist | Inbound only; $500+/mo; no campaigns |
| **Goodcall** | AI phone agent for SMBs | Inbound only; no Shopify integration; limited campaigns |
| **Air AI** | Outbound AI calling | Enterprise pricing; no inbound; no SMB focus |
| **Bland AI** | Voice AI infrastructure | Developer tool, not a product; no UI; no compliance |
| **Synthflow** | No-code voice AI | No native Shopify; weak campaign engine; no compliance |

### Infrastructure Players (Not Direct Competitors)

| Company | Why They're Not Competing |
|---------|--------------------------|
| Vapi, Retell, Bland | Sell engines to developers, not outcomes to merchants |
| ElevenLabs | Voice/AI infrastructure — we are a customer, not a competitor |
| Twilio | Telephony infrastructure — same |

### Aurora's Defensibility

1. **Integration depth** — Native Shopify tools (order lookup, cancel, discount, address) are not a weekend project. Each deep integration = 2-4 weeks of work that competitors must replicate.
2. **Compliance engine** — TCPA-grade consent/DNC is hard to build right and easy to get wrong. Once built, it's a trust moat.
3. **Data gravity** — Knowledge bases, call transcripts, customer preferences, campaign history. Switching cost grows with usage.
4. **Vertical templates** — Pre-built agent configurations tuned for specific industries. Network effect as community contributes.
5. **Cost advantage (Phase 4)** — Self-hosted voice cuts COGS by 50%+, enabling aggressive pricing.

---

## 9. Technical Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│               FRONTEND — React + TypeScript + Vite                    │
│                                                                       │
│  Dashboard · Agents · Campaigns · Contacts · Calls · Outcomes        │
│  Integrations · Settings · Knowledge Base · Voice Library            │
│                                                                       │
│  Real-time updates via Supabase Realtime (campaigns, usage)          │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTPS / REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              BACKEND — Node.js + Express                              │
│                                                                       │
│  Auth · Agent CRUD · Campaign Engine · Billing · Webhooks            │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ VoiceProvider   │  │ IntegrationHub   │  │ ComplianceGate    │  │
│  │ interface       │  │                  │  │                   │  │
│  │ • ElevenLabs    │  │ • Shopify        │  │ • can_dial()      │  │
│  │ • Vapi (standby)│  │ • Google Cal     │  │ • can_spend()     │  │
│  │ • Retell        │  │ • HubSpot        │  │ • DNC check       │  │
│  │ • Pipecat (P4)  │  │ • Zapier         │  │ • Hours check     │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘  │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌───────────────────┐  ┌──────────────────────┐  ┌──────────────────┐
│  ElevenLabs CAI   │  │  Supabase            │  │  Twilio          │
│                   │  │                      │  │                  │
│  • Agent hosting  │  │  • PostgreSQL + RLS  │  │  • Phone numbers │
│  • Voice synth    │  │  • Auth              │  │  • SMS (opt-out) │
│  • RAG/knowledge  │  │  • Realtime          │  │  • Call routing   │
│  • Call handling  │  │  • Edge Functions    │  │  • Subaccounts   │
│                   │  │  • Storage           │  │                  │
└───────────────────┘  └──────────────────────┘  └──────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Voice runtime | ElevenLabs CAI (Phase 1) | Best quality, native RAG, Twilio integration, 5000+ voices |
| Provider abstraction | `VoiceProvider` interface | Swap runtimes without rewriting the app (COGS optimization path) |
| Database | Supabase (PostgreSQL + RLS) | Multi-tenant isolation at the DB layer; real-time for live dashboards |
| Multi-tenancy | Shared tables + Row Level Security by `org_id` | Secure, cost-effective, standard SaaS pattern |
| Backend | Node.js + Express | Fast iteration, single-language stack, large talent pool |
| Frontend | React + Vite + Tailwind + shadcn/ui | Modern, fast, component library reduces design debt |
| Billing | Stripe (subscriptions + metered) | Industry standard; handles invoicing, payment failures, webhooks |
| Queue/workers | Background workers (dialer, billing rollup) | Campaign engine scales independently of the API |
| Secrets | Supabase Vault (reference pointers, never plaintext) | A database dump is never a credential breach |

### The VoiceProvider Abstraction (Strategic)

```
VoiceProvider interface:
  createAgent(config) → provider_ref
  updateAgent(ref, config) → updated
  deleteAgent(ref) → void
  startCall(params) → call_id
  endCall(call_id) → void
  assignPhoneNumber(agent, number) → void
  syncKnowledgeBase(source) → void

Implementations:
  ├── ElevenLabsProvider  ← Phase 1 (active)
  ├── VapiProvider        ← compiled, inactive (Phase 4 option)
  ├── RetellProvider      ← fallback
  └── PipecatProvider     ← Phase 4 self-host (COGS optimization)
```

This abstraction is the **single most important architectural decision**. It means:
- We can switch voice providers in days, not months
- We can negotiate vendor pricing from a position of leverage
- Phase 4 self-hosting is a ~200-line implementation, not a rewrite
- We are never locked into one vendor's pricing trajectory

---

## 10. Database & Data Model

### Core Entities

```
Organizations (orgs)
  ├── Users (team members, roles)
  ├── Agents (AI phone agents, personas, configs)
  │     ├── Knowledge Sources (docs, URLs, text)
  │     └── Phone Numbers (Twilio-provisioned)
  ├── Contacts (CRM, phone numbers, consent status)
  │     ├── Consent Events (append-only legal ledger)
  │     └── DNC List (suppression, keyed on phone number)
  ├── Campaigns (outbound batches)
  │     └── Campaign Targets (dialer state machine per contact)
  ├── Calls (every call: inbound + outbound)
  │     ├── Recordings (Supabase Storage)
  │     ├── Transcripts
  │     └── Outcomes (booked, recovered, deflected, etc.)
  ├── Usage Ledger (append-only metering)
  ├── Subscriptions (Stripe plan state)
  └── Integrations (Shopify, Calendar, CRM connections)
```

### Data Safety Design

| Principle | Implementation |
|-----------|---------------|
| No cross-tenant data access | Row Level Security (RLS) on every table, keyed on `org_id` |
| Consent is immutable | Append-only table with mutation-blocking triggers |
| No double-billing | Idempotency keys on usage ledger entries |
| No double-dialing | Lease-token pattern with `SKIP LOCKED` |
| Secrets never in plaintext | Vault references only; raw tokens never stored |
| DNC survives contact deletion | DNC keyed on phone number, not contact record |

### Scale Considerations

- **Partitioned tables:** `call_events`, `usage_ledger`, `webhook_events` — monthly partitions for write performance
- **Connection pooling:** Supavisor transaction mode for bursty workers
- **Indexing strategy:** minimal, targeted indexes on hot paths (dialer poll, consent lookup, billing rollup)

---

## 11. Security, Compliance & Legal

### TCPA Compliance (US Telephone Consumer Protection Act)

Aurora's compliance posture is **structural, not optional**. The pre-dial gate (`can_dial()`) is:
- A single SQL function that returns true/false
- Called before every outbound dial, at dial time (not just at campaign build time)
- Non-bypassable — there is no admin override, no "force dial" option
- Tested by property-based invariant tests in CI

**What this means for risk:**
- TCPA fines: $500-$1,500 per violation (per call)
- Aurora's architecture makes violations structurally impossible (not just unlikely)
- This is a genuine competitive moat — rebuilding this correctly takes months

### Opt-Out Handling

When a customer says "stop calling me" (voice or SMS):
1. Consent event recorded (append-only, immutable)
2. Contact's consent status updated
3. Phone number added to DNC list
4. All queued campaign targets for that number → suppressed
5. All of the above happens in **one database transaction**

The number is never called again. Not in this campaign. Not in any future campaign. Not by any agent.

### Data Security

| Layer | Protection |
|-------|-----------|
| Database | RLS policies on every table; no cross-tenant access possible |
| Secrets | Vault/KMS references; plaintext never stored |
| API | JWT auth + org_id claim; service role only for system ops |
| Webhooks | Signature verification before any processing |
| Recordings | Org-scoped storage buckets; retention policies enforced |
| Audit | Append-only ledgers for consent, usage, webhooks, dialer transitions |

### HIPAA Readiness (Architecture Only)

- Vendor BAA chain available (Twilio, ElevenLabs, Supabase)
- PHI redaction paths designed (not yet implemented)
- Storage isolation per-org already in place
- Full HIPAA program is Phase 3 (requires process, not just code)

### GDPR / CCPA

- Right to erasure: hard-delete contacts + scrub call PII
- Suppression preserved: hashed phone number stays in DNC (so we never call them again without storing their identity)
- Data export: contact export feature already built

---

## 12. Team & Execution

### Current Team

Small, focused, full-stack. Two technical co-founders building toward first hire.

### Key Competencies Required

| Role | Responsibility | Status |
|------|---------------|--------|
| Full-stack engineer (founding) | Frontend + backend + infra | Active |
| Voice AI / ML engineer | Provider integration, quality tuning | Post-seed hire |
| Growth / partnerships | Shopify ecosystem, merchant acquisition | Post-seed hire |

### Why We Can Execute

1. **Architecture is done** — not designing, building. Database locked, abstractions in place.
2. **Working product** — frontend functional, backend routes live, Supabase provisioned.
3. **Vendor relationships** — ElevenLabs grant application in progress; Twilio account live.
4. **Vertical focus** — one integration deep (Shopify), not ten integrations shallow.

---

## 13. Roadmap & Milestones

### Phase 1 — Foundation (Current, Weeks 1-8)

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| Auth + multi-tenant | Signup → org → RLS isolation | Done |
| Agent CRUD + ElevenLabs sync | Create/edit agents, sync to CAI | Done |
| Shopify OAuth + tools | Connect store, order lookup/cancel/discount | In progress |
| Phone number provisioning | Twilio subaccount, number purchase | In progress |
| Inbound call handling | Answer → playbook → outcome | In progress |
| Knowledge base | Upload → CAI RAG → agent access | Done |
| Consent + DNC gate | `can_dial()` + opt-out propagation | Done |
| Spend guards | Meter + hard cap from call #1 | Done |

### Phase 2 — Growth (Weeks 9-14)

| Milestone | Deliverable |
|-----------|-------------|
| Campaign engine | Build → schedule → dial → monitor → outcomes |
| Billing (Stripe) | Subscriptions + metered usage + invoicing |
| Outcomes dashboard | Per-agent, per-campaign metrics with filtering |
| Triggered outbound | Abandoned cart → automatic call (with consent) |
| CRM import/export | CSV/Excel/Google Sheets with consent attestation |

### Phase 3 — Expansion (Weeks 15-19)

| Milestone | Deliverable |
|-----------|-------------|
| Clinic vertical | Cal.com + Google Calendar integration |
| Additional integrations | HubSpot, Outlook, Zapier webhooks |
| Whitelabel (basic) | Logo + brand color on console + emails |
| Team members | Multi-user invite, roles (owner/admin/ops) |
| Shopify App Store listing | Public distribution |

### Phase 4 — Scale (Post-launch)

| Milestone | Deliverable |
|-----------|-------------|
| Self-hosted voice (Pipecat) | 50% COGS reduction |
| Outcome-based pricing | Per-booking / per-recovered-cart pricing |
| Enterprise tier | Custom SLAs, dedicated support |
| Additional verticals | Real estate, insurance, home services |
| Community templates | Marketplace for agent configurations |

---

## 14. Risks & Mitigations

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| ElevenLabs API instability | Calls fail, poor UX | VoiceProvider abstraction enables hot-swap to Vapi/Retell |
| Supabase connection limits | High-volume writes drop | Partitioned tables + connection pooling (Supavisor) |
| Voice quality regression | Customer complaints | Quality monitoring + provider failover |
| Twilio rate limiting | Campaigns throttled | Per-tenant subaccounts distribute limits |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| ElevenLabs raises pricing | Margin compression | Phase 4 self-host ready; VoiceProvider abstraction = swap in weeks |
| TCPA lawsuit | Existential | Structural compliance (can_dial gate); append-only audit trail; insurance |
| Slow merchant adoption | Revenue miss | Deep vertical focus (Shopify) with measurable ROI; freemium entry |
| Competitor copies the product | Market share | Integration depth + compliance moat + data gravity + cost advantage |
| Voice AI regulation tightens | Feature restrictions | Consent-first architecture already exceeds likely regulatory requirements |

### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Grant not approved | Higher burn rate | Unit economics still work at $0.14 COGS; just slower to profitability |
| Key person dependency | Development stalls | Architecture documented; no proprietary knowledge in one head |
| Vendor BAA gaps | Cannot serve healthcare | Architecture is BAA-ready; process work is Phase 3 |

---

## Appendix: Developer Reference

### Repository Structure

```
project/
├── src/                    # Frontend (React + TypeScript + Vite)
│   ├── pages/              # Route-level page components
│   ├── components/         # Shared UI (shadcn/ui + custom)
│   ├── lib/                # API client, Supabase client, utilities
│   └── config/             # Site config, marketing copy
├── backend/                # Backend (Node.js + Express)
│   ├── src/modules/        # Domain modules (agents, billing, campaigns, etc.)
│   ├── src/providers/      # VoiceProvider implementations
│   ├── src/workers/        # Background workers (dialer, billing rollup)
│   ├── src/middleware/     # Auth, validation, rate limiting, error handling
│   └── src/tests/          # Invariant tests (compliance, idempotency)
├── supabase/
│   ├── migrations/         # Forward-only SQL migrations
│   └── functions/          # Edge Functions (webhooks, OAuth, proxies)
└── docs/                   # This documentation
```

### Key Commands

```bash
# Frontend
npm run dev          # Start dev server (Vite)
npm run build        # Production build

# Backend
cd backend && npm start   # Start Express server
cd backend && npm test    # Run invariant tests
```

### Environment Variables

| Variable | Purpose | Where |
|----------|---------|-------|
| `VITE_SUPABASE_URL` | Supabase project URL | Frontend `.env` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | Frontend `.env` |
| `VITE_API_BASE_URL` | Backend API URL | Frontend `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access | Backend `.env` |
| `ELEVENLABS_API_KEY` | Voice AI provider | Backend `.env` |
| `TWILIO_ACCOUNT_SID` | Telephony | Backend `.env` |
| `TWILIO_AUTH_TOKEN` | Telephony | Backend `.env` |
| `STRIPE_SECRET_KEY` | Billing | Backend `.env` |

### Database Migrations

All schema changes go through `supabase/migrations/` as forward-only SQL files. Never drop columns, never delete data.

```
supabase/migrations/
├── 20260602_migrate_db.sql                    # Initial schema
├── 20260603_*                                 # v1 hardening (agents, contacts, knowledge, telephony)
├── 20260604_*                                 # ElevenLabs provider + spend guards
├── 20260610_*                                 # Integration hub + presets + WhatsApp
└── 20260611_*                                 # User profiles + waitlist + demo seed
```

### Invariant Tests (CI-Critical)

These tests enforce legal and business invariants. They must always pass.

| Test | What It Proves |
|------|---------------|
| `consent-gate.test.js` | No dial without consent |
| `consent-locked.test.js` | Outbound agents always require consent |
| `idempotency.test.js` | Duplicate webhooks produce exactly one effect |
| `webhook-sig.test.js` | Unsigned webhooks are rejected |
| `billing.test.js` | No call segment billed twice |
| `state-machine.test.js` | Campaign dialer transitions are valid |
| `inbound-gate.test.js` | Inbound calls pass admission gate |

### API Structure

```
/v1/agents          GET, POST
/v1/agents/:id      GET, PATCH, DELETE
/v1/agents/:id/test-call    POST
/v1/campaigns       GET, POST
/v1/campaigns/:id   GET, PATCH
/v1/calls           GET
/v1/contacts        GET, POST, DELETE
/v1/consent/events  GET, POST
/v1/consent/check   POST
/v1/consent/dnc     GET, POST
/v1/billing         GET
/v1/integrations    GET, POST
/v1/numbers         GET, POST
/v1/settings        GET, PATCH
```

---

**END OF AURORA BLACK BOOK**

*This document is the single reference for what Aurora is, how it works, how it makes money, and how it's built. For detailed specs: [v1 Scope Contract](Aurora-v1-Scope-and-Build-Contract.md) | [Database Guide](database-guide.md) | [UI/UX Spec](Aurora-UIUX-Spec.md).*
