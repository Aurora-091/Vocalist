# Weeber — Vertical-Tenant UX Case Study

**Design + User-Flow blueprint for turning the generic dashboard into a vertical-aware product.**

---

## 1. The Core Problem

Right now the dashboard is **generic**. It shows the same thing to everyone:

> "Bookings" stat next to "Cart recovery" copy. Inbound + Outbound cards mentioning both *appointment reminders* AND *cart recovery* in the same sentence.

This is the classic horizontal-platform trap (Vapi, Retell, ElevenLabs all do this — and it's exactly the gap Weeber is supposed to exploit). A Shopify merchant doesn't care about "no-shows." A clinic doesn't have a "cart." Showing both to both makes the product feel like a generic toolkit, not a **vertical voice workforce**.

**Weeber's entire wedge is vertical depth.** The UI has to reflect that or the positioning is a lie.

---

## 2. What "Multi-Tenant by Vertical" Actually Means Here

Two different things often get called "multi-tenant" — be precise:

| Layer | Meaning for Weeber | Status |
|---|---|---|
| **Org isolation** (data multi-tenancy) | Each customer = one `org`, data scoped by `org_id`. RLS already does this. | Already built |
| **Vertical persona** (product multi-tenancy) | Each org has a `vertical` (shopify / clinic / hotel) that reshapes the *entire UI surface*. | **This is the new work** |

So the change isn't a database rewrite — it's adding **one field on the org** (`vertical`) and making the frontend **render conditionally** off it. That's it. Cheap to build, huge product impact.

```
org {
  id
  name
  vertical: "shopify" | "clinic" | "hotel"   // ← the one new field that drives everything
  ...
}
```

---

## 3. User Flow — Signup → Vertical Selection → Tailored Workspace

### Current flow (broken)
```
Email signup → Generic dashboard (shows everything to everyone)
```

### New flow
```
Email signup
   ↓
Welcome screen ("What does your business do?")
   ↓
VERTICAL PICKER  ← new step, the critical decision point
   ↓
Vertical confirmed → org.vertical set
   ↓
Vertical-specific onboarding checklist
   ↓
Tailored dashboard (only this vertical's agents, tools, metrics, copy)
```

### 3.1 The Vertical Picker (the make-or-break screen)

Right after email verification, before they ever see the dashboard:

```
┌─────────────────────────────────────────────────────────┐
│   Welcome to Weeber                                       │
│   What kind of business are you setting up voice for?     │
│                                                           │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│   │   🛍️          │  │   🩺          │  │   🏨          │   │
│   │  Ecommerce   │  │   Clinic      │  │   Hotel       │   │
│   │  / Shopify   │  │ / Healthcare  │  │ / Hospitality │   │
│   │              │  │               │  │               │   │
│   │ Cart recovery│  │ Booking +     │  │ Reservations +│   │
│   │ order status │  │ reminders +   │  │ concierge +   │   │
│   │ support      │  │ no-show calls │  │ check-in      │   │
│   │              │  │               │  │               │   │
│   │  [ Select ]  │  │  [ Select ]   │  │  [ Coming ]   │   │
│   └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                           │
│   Not sure? → Talk to us / Generic setup                  │
└─────────────────────────────────────────────────────────┘
```

**Design rules for this screen:**
- Big tappable cards, not a dropdown. The choice *feels* important because it is.
- Each card shows the 3 things that vertical actually does — sells the value while qualifying them.
- Grey out / "Coming soon" badge for verticals not live yet (Hotel) — sets a roadmap expectation, looks more mature than hiding them.
- One escape hatch ("Not sure?") for edge cases — but default everyone into a vertical.

> **Inspiration:** This is the same pattern Notion ("What do you want to use Notion for?"), Linear, and most modern B2B SaaS use right after signup to branch the experience. Bolna does NOT do this well (flat template list) — it's a real differentiation point.

### 3.2 Can they change vertical later?

Yes — but make it deliberate, not a casual toggle. Put it in **Settings → Business type**. Changing it re-scopes the workspace. A merchant who pivots, or an agency managing multiple verticals, may need it. (Agency white-label = each client org has its own vertical — handled automatically by the org field.)

---

## 4. How Each Surface Changes Per Vertical

This is the meat. Same skeleton, different content, driven by `org.vertical`.

### 4.1 Dashboard metric cards

| Slot | Shopify | Clinic | Hotel |
|---|---|---|---|
| Card 1 | Calls (30d) | Calls (30d) | Calls (30d) |
| Card 2 | **Carts recovered** | **Bookings made** | **Reservations** |
| Card 3 | **Revenue recovered** | **No-shows prevented** | **Check-ins handled** |
| Card 4 | Opt-outs | Opt-outs | Opt-outs |

Card 1 and 4 are universal. Cards 2 & 3 swap entirely. **No clinic ever sees "Carts recovered."**

### 4.2 Inbound / Outbound cards (the copy that's currently mixed)

**Shopify:**
- Inbound: "Answer order-status questions, handle returns, qualify support tickets."
- Outbound: "Abandoned cart recovery, COD/RTO confirmation, delivery follow-ups."

**Clinic:**
- Inbound: "Book appointments, answer hours/location/insurance questions, route urgent calls."
- Outbound: "Appointment reminders, no-show recovery, follow-up scheduling."

**Hotel:**
- Inbound: "Take reservations, answer amenity questions, handle special requests."
- Outbound: "Booking confirmations, pre-arrival check-in, post-stay feedback."

### 4.3 Agents — pre-built templates per vertical

When they hit "Create agent," they only see **their vertical's** templates:

- **Shopify:** Cart Recovery Agent · Order Status Agent · COD/RTO Confirmation Agent · Support Triage Agent
- **Clinic:** Appointment Booking Agent · Reminder + No-show Agent · Front-desk FAQ Agent · Insurance Pre-check Agent
- **Hotel:** Reservation Agent · Concierge Agent · Pre-arrival Check-in Agent

(You already have Shopify + Clinic presets in the codebase — this just gates which set shows.)

### 4.4 Tools / Integrations

| Vertical | Surfaced integrations | Hidden |
|---|---|---|
| Shopify | Shopify, payment, SMS/WhatsApp | Cal.com, Google Calendar |
| Clinic | Cal.com, Google Calendar, Outlook | Shopify |
| Hotel | Booking/PMS, Calendar | Shopify |

Don't show a clinic the Shopify integration. Don't show a Shopify store Cal.com front-and-center.

### 4.5 Terminology / microcopy

Tiny but it's what makes it feel *built for them*:
- Shopify: "customers," "orders," "carts"
- Clinic: "patients," "appointments," "visits"
- Hotel: "guests," "reservations," "stays"

---

## 5. Sidebar Redesign (it's too crowded — 13 flat items)

### Current (flat, 13 items, no hierarchy)
```
Home · Agents · Campaigns · Conversations · Numbers · Contacts ·
Voices · Knowledge · Integrations · Analytics · Outcomes · Billing · Settings
```
Problem: everything has equal weight. Daily-use items (Home, Agents) sit next to rarely-touched config (Voices, Numbers, Billing). Cognitive overload.

### Proposed (grouped, scannable)

```
  ◆ Weeber

  ── OVERVIEW ──
   ◫  Home
   ↗  Outcomes          (rename → "Results" — clearer)

  ── BUILD ──
   ◧  Agents
   ☎  Campaigns
   💬 Conversations

  ── RESOURCES ──
   👥 Contacts
   📖 Knowledge

  ── SETUP ──        (collapsible, collapsed by default)
   #  Numbers
   🔊 Voices
   🔌 Integrations
   📊 Analytics

  ── (bottom-pinned) ──
   💳 Billing
   ⚙  Settings
   ↩  Sign out
```

**Why this works:**
- **OVERVIEW** = where you land and check results daily.
- **BUILD** = the core working loop (make agent → run campaign → review calls).
- **SETUP** = configure-once-then-forget. Collapse it by default — removes 4 items from visual noise.
- **Billing/Settings/Sign out** pinned to bottom, separated — standard pattern.
- Section labels (small grey caps) give instant scannability.

**Other sidebar wins:**
- Active item: left accent bar + filled icon (current highlight is too subtle).
- Collapsible to icon-only rail with hover tooltips (you have the screen-space problem on laptops).
- Vertical badge near logo: "🛍️ Shopify workspace" — constant reminder of context, and the switch point for agencies.

> **Inspiration:** Linear and Retell both group sidebar by function with collapsible sections. Bolna's sidebar is flat like yours — grouping is an easy polish win over them.

---

## 6. Voices Page Redesign (from the earlier ask, consolidated)

- **Shape:** kill the tall full-width rectangle rows → compact **cards in a 2–3 col grid**. Pill-shaped voice chips read as *selectable*, not as a spreadsheet.
- **Multilingual:** first-class filter + tag. For India this is a headline feature — surface **Hindi / Hinglish / Indian English** accent filters at the top.
- **Categorization:** the broad tabs ("Customer Support 225") are useless at that count. Add a second filter row: tone (Calm/Energetic/Formal), gender, language, accent.
- **Pagination:** 380 voices → virtualized scroll with sticky category headers, or numbered pages of ~24. Infinite-scroll-with-no-anchor is the worst option.
- **Inline play** more prominent; **Add** as a clear primary action per card.
- **Vertical-aware default:** pre-filter to voices that suit the org's vertical (e.g., warm/calm for clinics, upbeat for ecommerce) — small touch, big "it gets me" feeling.

---

## 7. Other Minor UX Wins Across the App

| Area | Issue | Fix |
|---|---|---|
| Agent list | No active/inactive visual difference | Status dot + muted text for paused |
| Call logs / Conversations | Flat table, no quick filters | "Today / This week / Failed" pill filters |
| Onboarding checklist | Step list with no progress feel | Progress bar % + reorder by what's incomplete |
| Empty states | No CTA when zero data | "No calls yet → Create your first agent" inline button |
| Dashboard "Live now" empty | Dead space | Show last 3 calls as a teaser instead |
| Agent detail tabs | No unsaved-change indicator | Dirty-state dot on the tab |
| Voice selector in Agent | Shows raw `voice_id` string | Resolve to voice name + accent from library |
| Numbers page | Likely a bare list | Show which agent each number is bound to |
| Mobile / <768px | Sidebar probably breaks | Collapsible drawer sidebar |
| Toasts | Confirm form success | Sonner success on save/connect everywhere |

---

## 8. Build Sequencing (so it's not one giant scary PR)

**Phase 1 — Vertical foundation (highest impact, smallest effort)**
1. Add `vertical` field to org + migration.
2. Vertical picker screen post-signup.
3. Dashboard metric cards + inbound/outbound copy read from a `verticalConfig` map.

**Phase 2 — Tailoring**
4. Gate agent templates by vertical.
5. Gate integrations by vertical.
6. Vertical terminology map across copy.

**Phase 3 — Polish**
7. Sidebar grouping + collapse.
8. Voices page redesign.
9. The minor UX wins table.

**Implementation tip:** centralize all per-vertical differences in ONE config file:

```ts
// verticalConfig.ts
export const VERTICALS = {
  shopify: {
    label: "Ecommerce / Shopify",
    icon: "shopping-bag",
    metrics: ["calls", "cartsRecovered", "revenueRecovered", "optOuts"],
    inbound: "Answer order-status questions, handle returns...",
    outbound: "Abandoned cart recovery, COD/RTO confirmation...",
    agentTemplates: ["cart_recovery", "order_status", "cod_confirm", "support_triage"],
    integrations: ["shopify", "whatsapp", "payments"],
    terms: { customer: "customer", item: "order" },
  },
  clinic: { /* ... */ },
  hotel: { /* ... */ },
}
```

Every component reads from `VERTICALS[org.vertical]`. One file to add a new vertical later. This is the clean way and keeps Bolt from scattering `if (vertical === 'shopify')` checks everywhere.

---

## 9. TL;DR

- **Don't fix the generic dashboard — replace the model.** Add `org.vertical`, branch the UI off it.
- **Add a vertical picker right after signup** — big cards, not a dropdown. This single screen makes the product feel vertical.
- **Each vertical gets its own** metrics, copy, agent templates, integrations, terminology — driven by one config file.
- **Regroup the sidebar** into Overview / Build / Resources / Setup; collapse Setup.
- **Redesign Voices** into a card grid with multilingual + tone filters and real pagination.
- **Approve the Bolt Shopify-OAuth plan separately** — it's good, ship it. But the vertical work above is a *different, bigger* effort — don't let Bolt bundle them.
