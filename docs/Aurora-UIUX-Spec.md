# Aurora — UI/UX & Frontend Spec

Companion to the Aurora Black Book. Covers sitemap, per-page component breakdowns, user flows, navigation/IA, component library, page states, role-based views, design system, and ASCII wireframes.

**Two launch verticals (tenants):**
- **Shopify merchant** (Maya) — cart recovery, order support, promo call blasts.
- **Clinic** — appointment booking/reminders, no-show recovery, intake triage.

Both run on the same console; vertical-specific surfaces are flagged **[SHOPIFY]** / **[CLINIC]**. Internal **[OPS]** views are a separate role.

---

## Table of Contents
1. [Design System](#1-design-system)
2. [Navigation & Information Architecture](#2-navigation--information-architecture)
3. [Sitemap / Page Inventory](#3-sitemap--page-inventory)
4. [Role-Based Views](#4-role-based-views)
5. [Component Library](#5-component-library)
6. [Page Specs + Wireframes](#6-page-specs--wireframes)
7. [User Flows](#7-user-flows)
8. [Page States Matrix](#8-page-states-matrix)

---

## 1. Design System

### 1.1 Brand tone
Trustworthy, calm, operational. This is a tool that *calls real customers/patients* — the UI must feel safe and auditable, never playful. Compliance status is always visible, never buried.

### 1.2 Color tokens
```
--bg            #0B0F14   (app shell, dark) / #F7F8FA (light default)
--surface       #FFFFFF   cards, panels
--surface-2     #F1F3F6   subtle fills, table stripes
--border        #E2E6EB
--text          #0E1726   primary
--text-muted    #5B6675   secondary
--primary       #2563EB   brand blue — primary actions
--primary-700   #1D4ED8   hover
--success       #16A34A   live agent, completed, consent-granted
--warning       #D97706   retry, expiring, attention
--danger        #DC2626   DNC, failed, opt-out, destructive
--info          #0891B2   informational
--consent-grant #16A34A   /  --consent-none #94A3B8  /  --consent-revoked #DC2626
```
Status colors are semantic and reused everywhere (badges, dots, charts) so a merchant learns one color language.

### 1.3 Typography
```
Font:  Inter (UI),  ui-monospace / "JetBrains Mono" (numbers, phone, IDs, transcripts)
Scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36  (rem-based, 1rem=16px)
Body 14–16, table cells 14, page H1 24–30, metric numbers 30–36 mono.
Line-height 1.5 body, 1.2 headings.
```

### 1.4 Spacing & layout
```
8px base grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
Radius:  sm 6  /  md 10  /  lg 16  /  full (pills, avatars)
Shadow:  card = 0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.10)
Container: max 1280px content; sidebar 240px; right drawer 420px.
Breakpoints: mobile <640, tablet 640–1024, desktop >1024.
```

### 1.5 Motion & a11y
- Transitions 150–200ms ease-out; respect `prefers-reduced-motion`.
- WCAG AA contrast; full keyboard nav; ARIA landmarks; focus rings on all interactive elements.
- Live regions (`aria-live=polite`) for the campaign monitor and call-status changes.
- Touch targets ≥ 44px on mobile.

---

## 2. Navigation & Information Architecture

### 2.1 App shell (desktop)
```
┌──────────┬──────────────────────────────────────────────────────────┐
│ SIDEBAR  │  HEADER:  [Org switcher ▾] ........ [Usage 412/1000 min]   │
│ (240px)  │           [Compliance ●] [Help] [🔔 3] [Avatar ▾]          │
│          ├──────────────────────────────────────────────────────────┤
│ • Home   │                                                            │
│ • Agents │   PAGE CONTENT (max 1280, 24px gutters)                    │
│ • Campns │                                                            │
│ • Calls  │                                                            │
│ • Contacts                                                            │
│ • Integr.│                                                            │
│ • Outcomes                                                            │
│ • Billing│                                                            │
│ ──────── │                                                            │
│ • Settings                                                            │
│ • [OPS]  │                                                            │
└──────────┴──────────────────────────────────────────────────────────┘
```

### 2.2 Sidebar items (merchant role)
```
Home (Dashboard)        Agents              Campaigns
Calls & Transcripts     Contacts            Integrations
Outcomes                Billing & Usage     ─────  Settings
```
**[OPS]** role adds a top-level **Ops** section (see §4).

### 2.3 Header (persistent)
- **Org switcher** — for users in multiple orgs/verticals.
- **Usage meter** — live `used / included` minutes pill; turns warning at 80%, danger at 100%.
- **Compliance status dot** — green = all gates healthy; amber = attention (e.g. unverified Shopify consent source); red = a blocking issue. Click → Compliance panel.
- **Notifications**, **Help**, **Avatar menu** (profile, role, sign out).

### 2.4 Mobile navigation
```
┌────────────────────────────┐
│ ☰  Aurora      🔔  [Avatar] │  top bar
├────────────────────────────┤
│        page content        │
│                            │
├────────────────────────────┤
│ [Home][Calls][＋][Campn][⋯] │  bottom tab bar (5 max)
└────────────────────────────┘
```
- Bottom tab bar: Home, Calls, **＋ (quick action)**, Campaigns, More (drawer to the rest).
- ＋ opens a context sheet: New Campaign / New Agent / Add Contacts.
- Tables collapse to stacked cards; right drawers become full-screen sheets.

---

## 3. Sitemap / Page Inventory

```
/ (Landing — marketing, unauth)
/login              /signup            /auth/callback (OAuth)
/onboarding         (wizard: vertical → connect → agent → test call → go live)

AUTHENTICATED CONSOLE
/                   Home / Dashboard
/agents             Agents list
/agents/:id         Agent detail/editor (persona, voice, number, playbook)
/campaigns          Campaigns list
/campaigns/new      Campaign builder (multi-step)
/campaigns/:id      Campaign detail + LIVE MONITOR
/calls              Calls & Transcripts list
/calls/:id          Call detail (transcript, recording, outcome, events)
/contacts           Contacts list (consent + DNC state)
/contacts/:id       Contact detail (consent history timeline)
/contacts/import    Import wizard (CSV / Shopify / CRM) w/ consent attestation
/integrations       Integrations hub
/integrations/:type Connect/config (Shopify, Cal.com, Google, Outlook, CRM, Zapier, Stripe, Twilio)
/outcomes           Outcomes dashboard (filters: date/agent/campaign/vertical)
/billing            Billing & Usage (plan, meter, invoices, alerts)
/settings           Org · Members/roles · Calling hours/TZ · Compliance defaults · Notifications

INTERNAL [OPS] (role-gated)
/ops                Ops overview (all orgs health)
/ops/calls          Cross-org call QA queue
/ops/compliance     Consent/DNC audit explorer
/ops/orgs           Tenant management
/ops/abuse          Fraud/abuse + velocity flags
```

---

## 4. Role-Based Views

Roles map to `users.role` enum: **owner**, **admin**, **ops**. (Internal Aurora staff use a separate ops org / elevated `ops`.)

| Surface | owner | admin | ops (merchant) | OPS (internal) |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ (read) | cross-org |
| Agents edit | ✓ | ✓ | view | view |
| Campaigns create/run | ✓ | ✓ | view | view |
| Contacts import | ✓ | ✓ | ✓ | — |
| Consent/DNC override | ✓ | ✓ | — | audit-only |
| Billing | ✓ | view | — | view |
| Members/roles | ✓ | — | — | — |
| Integrations connect | ✓ | ✓ | — | — |
| Settings (calling hours) | ✓ | ✓ | — | — |
| Ops section | — | — | — | ✓ |

UI rule: hide what a role can't do; for partial access show the control **disabled with a tooltip** ("Owner only") rather than vanishing it, so expectations are clear.

---

## 5. Component Library

### 5.1 Primitives
```
Button       primary / secondary / ghost / danger ; sizes sm/md/lg ; loading spinner state
IconButton   square, 40px, tooltip on hover
Input        text/number/phone(masked +E.164)/email ; label, helper, error slot
Select       single + searchable ; multi-select (chips)
DatePicker / TimePicker / DateTimeRange  (TZ-aware, shows explicit TZ label)
Toggle / Checkbox / Radio
Textarea     (campaign script, agent persona)
Tag/Chip     removable ; used for skills, segments, filters
Tooltip / Popover
```

### 5.2 Data display
```
Card             header + body + footer-actions
StatCard         big mono number + label + delta arrow (▲/▼ vs prev period)
DataTable        sortable, paginated (Load More / page), row-select, sticky header,
                 column visibility, empty/loading/error slots
Badge            status badges (see status system below)
ConsentBadge     granted ● / none ● / revoked ● with icon + label
StateBadge       dialer state (queued/dialing/in_call/completed/failed/voicemail/DNC...)
Avatar           initials fallback, status dot
Timeline         vertical event log (consent history, dialer transitions, call events)
ProgressBar      campaign progress (done / total) + segmented by outcome
UsageMeter       radial or bar; used/included with threshold colors
MiniChart        sparkline + bar/line for outcomes
TranscriptView   role-tagged turns (caller/agent), timestamps, tool-call chips, audio sync
AudioPlayer      waveform scrub, speed, jump-to-turn
```

### 5.3 Overlays & feedback
```
Modal / Dialog        confirm destructive (delete campaign, override DNC) — typed confirm for high-risk
Drawer (right 420px)  call detail, contact detail, quick-edit — keeps list context
Sheet (mobile)        full-screen drawer equivalent
Toast                 success / error / info ; auto-dismiss 4s ; action link
Banner                page-level (compliance warning, billing overage, integration broken)
Skeleton              per component (table rows, cards, chart)
EmptyState            illustration + headline + primary CTA
ErrorState            cause + retry + "contact support" ; never a raw stack trace
ConfirmGate           red-bordered modal for legal-critical actions (override consent, bulk DNC)
```

### 5.4 Status color system (reused everywhere)
```
● green   live / completed / consent granted / healthy
● amber   retry_wait / expiring / 80% usage / attention
● red     failed / DNC / revoked / opt-out / blocked
● gray    queued / none / draft / inactive
● blue    dialing / in_progress / info
```

---

## 6. Page Specs + Wireframes

### 6.1 Onboarding wizard  `/onboarding`
**Goal:** vertical → connect a source → create agent → test call → go live, in <10 min.
**Steps:** (1) Pick vertical [Shopify | Clinic] (2) Connect (OAuth/API) (3) Agent basics (name, voice, playbook template) (4) **Test call to your own number** (5) Go live.

```
┌───────────────────────────────────────────────────────────┐
│  Aurora setup                              Step 3 of 5      │
│  ●──●──●──○──○                                              │
├───────────────────────────────────────────────────────────┤
│  Create your agent                                          │
│                                                             │
│  Agent name   [ Front Desk            ]                     │
│  Voice        [ Calm female ▾ ]  [▶ preview]                │
│  Playbook     ( ) Order support  (•) Cart recovery  [SHOPIFY]│
│               ( ) Appointment booking  ( ) Reminders [CLINIC]│
│  Greeting     [ "Hi, thanks for calling…"          ]        │
│                                                             │
│            [ Back ]                       [ Continue → ]    │
└───────────────────────────────────────────────────────────┘
```
**States:** connect-failure inline error + retry; "skip test call" disabled-with-tooltip (we strongly gate go-live behind a successful test).

---

### 6.2 Home / Dashboard  `/`
**Components:** 4 StatCards, live activity feed, compliance banner (conditional), quick actions, recent calls table.

```
┌───────────────────────────────────────────────────────────────────┐
│  Good morning, Maya                         [+ New campaign]        │
│  ⚠ Banner: 2 Shopify contacts missing consent source — review  [→] │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ Calls today  │ Deflection   │ Carts recov. │ Opt-out rate         │
│   84  ▲12%   │   71% ▲4%    │ $1,240 ▲$300 │   1.8%  ▼0.3%        │  [SHOPIFY]
│              │              │ Bookings  37 │ No-show recov. 22%   │  [CLINIC]
├──────────────┴──────────────┴──────────────┴──────────────────────┤
│ Live now (2 agents active)            │ Recent calls               │
│ ● Front Desk — in call (00:42)        │ +1•••212  inbound ✓ booked │
│ ● Recovery  — dialing (3/120)   [→]   │ +1•••880  outbound ✓ recov │
│   ▓▓▓▓▓▓▓░░░░░  2.5%                   │ +1•••104  voicemail        │
└───────────────────────────────────────┴────────────────────────────┘
```

---

### 6.3 Agents  `/agents` and `/agents/:id`
List = cards/table of agents (name, vertical, number, status, calls 7d). Detail = tabbed editor.

```
/agents/:id
┌───────────────────────────────────────────────────────────┐
│ ← Front Desk        ● live    inbound: +1 415 ••• 0199      │
│ [Persona] [Voice] [Playbook] [Numbers] [Test]              │
├───────────────────────────────────────────────────────────┤
│ Persona / system prompt                                     │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ You are the front desk for Maya's Store…            │    │
│ └─────────────────────────────────────────────────────┘    │
│ Tools enabled:  [✓ Shopify order lookup] [✓ Issue discount] │
│                 [✓ Book appointment (Cal.com)]  [CLINIC]    │
│ Escalation:     transfer to [ +1 ••• ]  after [3] attempts  │
│                                   [ Save ]  [ ▶ Test call ] │
└───────────────────────────────────────────────────────────┘
```

---

### 6.4 Campaign builder  `/campaigns/new`
Multi-step: (1) Audience (2) Script/agent (3) Schedule & limits (4) **Compliance review** (5) Launch. The compliance step is mandatory and shows exactly how many targets will be suppressed.

```
Step 4 — Compliance review                         ●●●●○
┌───────────────────────────────────────────────────────────┐
│ Audience: 1,204 contacts from "Past buyers 90d"            │
│                                                             │
│  ✓ Consent granted .................... 1,031              │
│  ✗ No consent (will be skipped) ........   142  [view]     │
│  ✗ On DNC (will be skipped) ............    31  [view]     │
│  ⏰ Outside calling hours (deferred) ...  (runtime)         │
│  ─────────────────────────────────────────                │
│  Will dial: 1,031   ·  Suppressed: 173                     │
│                                                             │
│  Calling window: Mon–Fri 9:00–19:00  (America/New_York)    │
│  Concurrency: 5    Max retries: 2                           │
│                                                             │
│  ⚠ Suppressed contacts are never dialed and are logged.    │
│            [ Back ]                  [ Review & Launch → ]  │
└───────────────────────────────────────────────────────────┘
```
**Launch** opens a ConfirmGate modal ("Dial 1,031 contacts? This places real calls.").

---

### 6.5 Campaign detail + Live Monitor  `/campaigns/:id`
Realtime. ProgressBar segmented by outcome; live target table streaming state changes; pause/stop.

```
┌───────────────────────────────────────────────────────────────────┐
│ ← Recovery blast          ● running     [⏸ Pause] [■ Stop]          │
│ Progress  ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  612 / 1031   (59%)                   │
│ ┌ completed 410 ┐┌ in-call 5 ┐┌ voicemail 120 ┐┌ failed 47 ┐        │
│ ──────────────────────────────────────────────────────────────────  │
│ Outcomes:  ✓ recovered $3,120 · booked 0 · opt-out 9                │
│ ──────────────────────────────────────────────────────────────────  │
│ PHONE        STATE        ATTEMPT  OUTCOME       UPDATED   (live)   │
│ +1•••212     ● in_call    1        —             now               │
│ +1•••104     ● voicemail  1        vm_drop       3s                 │
│ +1•••991     ● retry_wait 1        no_answer     12s                │
│ +1•••330     ● do_not_call —       opt_out       1m   [DNC]         │
└───────────────────────────────────────────────────────────────────┘
```
**States:** paused (amber banner), completed (summary card replaces controls), error (provider/runtime issue banner + safe auto-pause).

---

### 6.6 Calls & Transcripts  `/calls`, `/calls/:id`
List = DataTable (time, direction, number, agent, campaign, duration, outcome, status). Row → right Drawer with detail.

```
/calls/:id  (drawer)
┌──────────────────────────────────────────┐
│ Call +1 415 ••• 0199   inbound  ✓ completed│
│ Agent Front Desk · 03:12 · $0.34 cost      │
│ Outcome: [booked ▾]   Consent: ● granted   │
│ ───────────────────────────────────────── │
│ ▶ ▓▂▅▇▃▂▅  00:42 / 03:12   1.0x            │
│ ───────────────────────────────────────── │
│ Transcript                                  │
│  Agent  Hi, thanks for calling…   00:00     │
│  Caller I want to book…           00:08     │
│  ⚙ tool_call: book_appointment    00:31     │
│  Agent  You're booked for…        00:40     │
│ ───────────────────────────────────────── │
│ Events: ringing→in_progress→completed       │
│ [ Flag for QA ]            [ Download .wav ] │
└──────────────────────────────────────────┘
```

---

### 6.7 Contacts  `/contacts`, `/contacts/:id`, `/contacts/import`
List shows consent + DNC state prominently with filters. Detail = consent history **Timeline** (from the append-only ledger). Import wizard forces a **consent attestation** step.

```
/contacts
┌───────────────────────────────────────────────────────────────────┐
│ Contacts                  [Filter: Consent ▾][Source ▾] [Import ⤓]  │
│ NAME         PHONE        CONSENT      SOURCE     DNC   LAST CALL    │
│ J. Rivera    +1•••212     ● granted    shopify    —     2d ago      │
│ A. Kohl      +1•••880     ● none       upload     —     —           │
│ M. Singh     +1•••330     ● revoked    inbound    ●     1m ago      │
└───────────────────────────────────────────────────────────────────┘

/contacts/:id  consent timeline
│ ● grant   web_form     2026-04-01  evidence: form#a91   │
│ ● revoke  voice "stop" 2026-06-02  → added to DNC        │
```
Import wizard step: *"I attest these contacts gave consent to be called"* checkbox (required) + source-of-consent field → recorded as `import_attest` events.

---

### 6.8 Integrations  `/integrations`
Grid of connectable apps with status. Vertical-aware ordering (Shopify first for merchants, Cal.com first for clinics).

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Shopify  │ │ Cal.com  │ │ Google   │ │ Stripe   │
│ ● connected│ ○ connect │ ○ connect │ ● connected│
│ [Manage] │ │ [Connect]│ │ [Connect]│ │ [Manage] │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Outlook  │ │ CRM      │ │ Zapier   │
│ ○ connect│ │ ○ connect│ │ ○ connect│
└──────────┘ └──────────┘ └──────────┘
```
**States:** broken integration → red badge + banner + reconnect CTA.

---

### 6.9 Outcomes  `/outcomes`
Charts + breakdowns, filterable by date/agent/campaign/vertical. Vertical-specific metrics swap in.

```
┌───────────────────────────────────────────────────────────┐
│ Outcomes   [Date ▾][Agent ▾][Campaign ▾][Vertical ▾]        │
├──────────────┬──────────────┬──────────────────────────────┤
│ Calls handled│ Deflection % │  Recovered $ (line chart)     │ [SHOPIFY]
│  1,402       │   68%        │  Bookings / No-show recov %   │ [CLINIC]
├──────────────┴──────────────┴──────────────────────────────┤
│ Bar: outcomes by type   ▓ booked ▓ recovered ▓ deflected    │
│ Table: per-campaign conversion + opt-out rate               │
└───────────────────────────────────────────────────────────┘
```

---

### 6.10 Billing & Usage  `/billing`
Plan card, live UsageMeter, overage, invoices, cap-alert settings.

```
┌───────────────────────────────────────────────────────────┐
│ Plan: Growth — 1,000 min/mo            [ Change plan ]      │
│ Usage this period   ▓▓▓▓▓▓▓▓░░  412 / 1000 min  (41%)       │
│ Overage: $0.00     Renews Jun 30                            │
│ Alerts:  [✓] 80%   [✓] 100%                                 │
│ ───────────────────────────────────────────────────────── │
│ Invoices                                                    │
│  May 2026   $149.00   paid     [PDF]                        │
│  Apr 2026   $149.00   paid     [PDF]                        │
└───────────────────────────────────────────────────────────┘
```
**States:** ≥80% usage → amber banner; ≥100% → danger banner + overage line; payment failed → blocking banner.

---

### 6.11 Settings  `/settings`
Tabs: Org · Members & roles · Calling hours/timezone · Compliance defaults · Notifications.

```
[Org][Members][Calling hours][Compliance][Notifications]
Calling hours
  Window  [09:00] – [19:00]   Timezone [America/New_York ▾]
  Days    [✓Mon ✓Tue ✓Wed ✓Thu ✓Fri ☐Sat ☐Sun]
Compliance defaults
  Default consent required for outbound   [✓ on]  (cannot disable)
  Voicemail drop allowed                  [✓]
```
The "consent required" toggle is **locked on** with a tooltip — it's a legal invariant, surfaced but not editable.

---

### 6.12 [OPS] Internal views  `/ops/*`
```
/ops               cross-org health grid (calls, error rate, usage, flags)
/ops/calls         QA queue: flagged + sampled calls across orgs
/ops/compliance    consent/DNC audit explorer — search by number, see full ledger
/ops/abuse         velocity/fraud flags (orgs dialing abnormally), suspend control
/ops/orgs          tenant list, plan, status, impersonate (audited)
```
Ops views are **read + audit first**; any write (suspend org, override) goes through a ConfirmGate and is itself logged.

---

## 7. User Flows

### 7.1 Onboarding → first live agent
```
signup → /onboarding
  pick vertical (Shopify | Clinic)
    → connect source (OAuth) ──fail──▶ inline error + retry
    → create agent (name, voice, playbook template)
    → TEST CALL to own number ──must succeed──▶ enable "Go live"
    → Go live → redirect /  (Dashboard, empty-but-armed state)
```

### 7.2 Inbound call (no UI action; surfaces live)
```
Customer/patient dials agent number
  → agent answers, runs playbook, tool-calls (order lookup / book appt)
  → Dashboard "Live now" + Recent calls update via Realtime
  → call ends → /calls row appears → outcome auto-tagged, editable
```

### 7.3 Outbound campaign
```
/campaigns/new
  audience (segment / Shopify pull / CRM / CSV)
  → script + agent
  → schedule (window, TZ, concurrency, retries)
  → COMPLIANCE REVIEW (shows dial vs suppressed counts)
  → ConfirmGate "Dial N contacts?" → Launch
  → /campaigns/:id LIVE MONITOR (pause/stop, streaming states)
  → completion summary (outcomes + opt-outs)
```

### 7.4 Opt-out (legal-critical, mostly automatic)
```
During/after a call: "stop" / SMS STOP / web form
  → consent_events(revoke) written
  → contact flips to ● revoked, added to DNC
  → any queued targets for that number → ● do_not_call (live in monitor)
  → UI: contact timeline shows revoke; campaign monitor row turns red
  → number never dialed again (this run + all future)
Manual: ops/admin can add to DNC via contact detail → ConfirmGate.
```

### 7.5 Billing / overage
```
Usage accrues → meter updates live (header pill + /billing)
  → 80% → amber banner + (optional) email alert
  → 100% → danger banner; overage line begins; cap behavior per plan
  → invoice generated end of period → /billing invoices list (PDF)
  → payment fails → blocking banner until resolved
```

---

## 8. Page States Matrix

Every page must implement: **loading**, **empty**, **error**, **populated**, and (where relevant) **role-restricted** and **live**.

| Page | Empty | Loading | Error | Special |
|---|---|---|---|---|
| Dashboard | "No calls yet — your agent is armed" + test-call CTA | StatCard + feed skeletons | data-fetch banner + retry | compliance/billing banners; live feed |
| Agents | "Create your first agent" | card skeletons | retry | test-call inline result |
| Campaigns | "No campaigns — start one" CTA | table skeleton | retry | — |
| Campaign detail | (n/a once created) | progress + table skeleton | provider error → auto-pause banner | **live** stream; paused/completed variants |
| Calls | "No calls in this range" | table skeleton | retry | drawer detail; audio load error |
| Contacts | "Import contacts to begin" + import CTA | table skeleton | retry | consent filters; import attestation gate |
| Integrations | all show "Connect" | card skeletons | broken-integration red badge + reconnect | per-card status |
| Outcomes | "No data for filters" | chart skeleton | retry | filter-empty vs no-data distinction |
| Billing | (always populated) | meter/list skeleton | payment-failed blocking banner | 80/100% threshold banners |
| Settings | — | form skeleton | save-error toast | locked compliance controls |
| Ops/* | "No flags" | table skeleton | retry | audited write confirmations |

**Error rule:** never show raw errors. Pattern = *what happened* + *what to do* + *retry/contact support*. Legal-critical actions always pass through a ConfirmGate with an explicit consequence sentence.

---

**END OF AURORA UI/UX SPEC**

Pairs with: Aurora Black Book (architecture + data model), Database Design Guide (schema), PRD (scope), Red-Team Review (risks).
