# Aurora — Startup Gaps Report
### What's missing before: Demo / First Merchant / Seed Raise

---

## A. Investor Demo (2–3 weeks out)

| Gap | Status | Blocker? |
|-----|--------|----------|
| Dialer worker fires real outbound calls | ❌ Missing — workers/ dir empty | YES — can't demo outbound |
| Inbound call connects to correct agent | ❌ TwiML route not wired | YES — can't demo inbound |
| One working Shopify integration (read orders) | ❌ shopify.provider.js is a stub | YES — demo story breaks |
| Live dashboard showing real-time call log | ⚠️ UI exists, no live data | Medium |
| Stripe payment flow (signup → plan → charged) | ❌ Not wired | Medium (investors check this) |
| Single polished demo merchant + demo number | ❌ Not set up | YES |
| 30-second cold call demo recording | ❌ Not recorded | YES |

**Minimum for a convincing investor demo:**
1. Dialer worker → real outgoing call → voice agent speaks → call logged in dashboard
2. Inbound call → number answers → agent introduces itself → escalation to human
3. Shopify "abandoned cart" use case: fetch order, mention product in call script
4. One real dashboard showing call count, duration, outcome

---

## B. First Real Merchant (4–6 weeks out)

| Gap | Status | Notes |
|-----|--------|-------|
| OAuth Shopify app (not paste-token) | ❌ Missing | Required for App Store or any real merchant |
| Shopify tools: lookup_order, cancel_order, apply_discount | ❌ Stubs only | Core merchant value prop |
| Knowledge base upload (PDF → CAI) | ⚠️ UI exists, untested end-to-end | Test and fix |
| Billing: plan enforcement + overage charge | ❌ Stripe not connected | Merchants can't pay |
| Onboarding wizard tested end-to-end | ❌ Unknown state | Must manually QA |
| GDPR / consent language on call start | ❌ Not in agent prompts | Legal risk |
| Call recording opt-out / disclosure | ❌ Not implemented | Legal risk (India DPDPA + global) |
| Merchant support channel | ❌ None | Even WhatsApp works for MVP |

**Non-negotiables before first signed contract:**
- OAuth Shopify app OR pilot with a dev-store merchant using paste-token with clear disclaimer
- At least read-orders + lookup_order tool working
- Stripe plan billing live
- Consent disclosure in agent greeting

---

## C. Seed Raise Readiness

| Gap | Status | Notes |
|-----|--------|-------|
| ElevenLabs ToS confirmation (SaaS-on-API) | ❌ Pending — send email | Investors will ask |
| COGS model validated with real call data | ❌ No real calls yet | Claimed $0.15/min — needs proof |
| Pricing page / public waitlist | ❌ Not built | Any serious investor will check |
| 1 paying or LOI-signed merchant | ❌ None | Strong signal for angels |
| Deck: traction slide with real numbers | ❌ No real numbers | Pilot metrics needed |
| Legal entity (LLP / Pvt Ltd India) | ❓ Unknown | Required for wire transfers |
| Cap table / SAFE draft | ❓ Unknown | Required before US/India angels |
| Privacy policy + ToS on product | ❌ Missing | Day-1 requirement |

**What will unlock the raise:**
1. 2–3 LOI or paid pilot merchants (even at $0 → "design partners")
2. One demo call recording with real Shopify data (the money shot)
3. ElevenLabs partnership/startup confirmation email
4. Clean 10-slide deck with: problem → solution → demo → COGS → pricing → traction → ask

---

## Priority Order (Next 30 Days)

```
Week 1
├── Send ElevenLabs email (TODAY)
├── Wire dialer worker (outbound call fires)
├── Wire inbound TwiML route
└── Fix shopify-proxy vault lookup

Week 2
├── Implement lookup_order + apply_discount_code tools
├── Connect Stripe billing (plan enforcement)
├── Set up 1 demo Shopify merchant (dev store)
└── Record demo call end-to-end

Week 3
├── QA full onboarding wizard
├── Add consent disclosure to agent greeting
├── Build public waitlist / pricing page
└── Approach 3 Shopify merchants as design partners

Week 4
├── Finalize deck with real pilot metrics
├── Register legal entity if not done
└── Begin angel outreach (India: Tracxn, LetsVenture, direct LinkedIn)
```

---

## One-Line Summary

> Aurora's schema and UI are solid. The gap is: **zero working calls, zero Stripe revenue, zero real merchants.** Fix those three in 2 weeks and the raise story becomes real.
