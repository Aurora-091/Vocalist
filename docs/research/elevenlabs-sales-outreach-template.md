# ElevenLabs sales outreach — ToS validation + plan recommendation

> **Why:** Phase 0 of the [Phase-1 implementation plan](../implementation-plan-phase-1.md) requires written confirmation from ElevenLabs that our SaaS-on-API usage pattern is in-ToS before any runtime provisioning code ships. This is the audit trail decision in the [critique-response doc](./critique-response-and-decisions.md).
>
> **Who:** founder / product lead.
> **When:** before workstream 1.2 (`ElevenLabsProvider` implementation). Their reply typically lands within 3–5 business days.
> **Where to file the reply:** save the inbound reply as `docs/research/elevenlabs-tos-confirmation.md` (paste body + sender + date). That file is the evidence we did this.

---

## To

`sales@elevenlabs.io`

**Cc:** founder + (optionally) operations / legal advisor.

## Subject

```
SaaS on Conversational AI API — plan recommendation & ToS scope confirmation
```

## Body

```
Hi ElevenLabs team,

I run Aurora, a voice-AI SaaS for small businesses in the Shopify (cart
recovery, order support) and clinic (appointment booking, intake triage)
verticals. We've finalised our v1 architecture choice and would like to
build on ElevenLabs Conversational AI as our agent runtime.

I'd like to (a) confirm the usage pattern is within your standard
Conversational AI terms and (b) get a plan recommendation for pre-seed
through early-revenue.

**Architecture**

- Aurora is the customer-facing product. Customers sign up at our domain,
  use our UI, and only ever see the Aurora brand. They do not get an
  ElevenLabs account, do not see ElevenLabs branding, and do not receive
  API keys.
- One ElevenLabs workspace, billed to Aurora. We pay you a single bill;
  we meter and charge our customers on Aurora-native pricing tiers
  (subscription + bundled minutes + overage).
- Per Aurora customer ("org"), we create one or more CAI agents via the
  Agents API. The agent's persona, knowledge base, voice and language are
  configured by the Aurora customer through our no-code UI; we map that
  to ElevenLabs API calls server-side.
- Telephony is Twilio (our managed sub-account per tenant). Inbound calls
  hit our endpoint first for rate-limit and spend-guard checks, then we
  hand the media to the CAI agent via SIP/stream. We do not use the
  native CAI<>Twilio number-binding for inbound.
- Knowledge bases use the CAI native Knowledge Base API + RAG. We do not
  run our own vector database.
- We plan to apply for the ElevenLabs Startup Grant (separate
  application) to cover the first year of CAI minutes; the Stripe
  Billing + Twilio costs are funded normally.

**Vertical use cases**

- Shopify merchants — outbound cart-recovery agent that uses CAI function
  tools (lookup_order, apply_discount_code, update_address,
  cancel_order). Trigger is a Shopify abandoned-checkout webhook.
- Clinic practices — inbound appointment-booking agent and an intake
  triage agent that use Cal.com / Google Calendar function tools
  (book_appointment, reschedule, check_availability).

**Compliance posture (so you know who you'd be selling to)**

- TCPA consent + DNC ledgers + calling-hours gate on every outbound
  call (separate from CAI).
- Two-party-consent recording: off by default, opt-in per tenant with a
  mandatory disclosure preamble in the agent's first message when on.
- HIPAA: not in v1; we are not handling PHI. If we win a clinic deal that
  requires BAA we'll come back to discuss your HIPAA add-on.

**Asks**

1. Please confirm this SaaS-on-API usage pattern is within your standard
   Conversational AI terms and does not require a separate OEM
   agreement at our current stage.
2. Recommend the right plan to start on. We expect roughly 1,500
   conversational minutes per active customer per month, ramping from
   ~5 customers in the first quarter post-launch.
3. Are there any architectural or contractual gotchas we should know
   about before we wire up agent provisioning?

Happy to share more architecture detail or jump on a 20-minute call if
that's faster.

Thanks,
{Your name}
Founder, Aurora — {website / LinkedIn}
```

---

## What to do with the reply

1. Paste the full reply into `docs/research/elevenlabs-tos-confirmation.md` with sender name + date headers. Markdown is fine. Redact any pricing they share privately if it's marked confidential.
2. If they recommend a paid plan: log the plan name and cost in the same file. Phase-1 plan §1 cost model assumes Pro ($99/mo) at launch with the grant on top.
3. If they flag any concern (e.g. "you'll need to display a 'powered by ElevenLabs' note in some context", or "the OEM agreement applies if X"): surface it as an issue in this repo before workstream 1.2 starts, so we either accept the constraint or push back.
4. If they don't reply within 5 business days, follow up once. If they don't reply within 10, proceed with the architecture as designed (the pattern is the same as Synthflow / Decagon / Air, none of which have public OEM contracts) and revisit if they ever do reach out.

---

## Why this matters

This is the only Phase-0 task that touches **another company's terms**, not our own infrastructure. Getting it on file:

- Removes the OEM-clause risk flagged in the research brief §7.
- Gives us a written record if we ever need to defend the architecture to a future investor, customer, or auditor.
- Tells us early if we need to redesign anything before we've written the code (cheapest moment to redesign).

The email is short on purpose — sales teams reply faster to specific, qualified asks. If it goes unanswered after one follow-up, that's its own data point.
