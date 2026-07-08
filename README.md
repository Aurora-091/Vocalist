# Weeber

AI voice agent platform for SMB ecommerce and clinics (formerly "Aurora"). Weeber lets merchants deploy phone-based AI agents that handle cart recovery, appointment reminders, and inbound support — no code required.

**Stack:** React + Vite + Tailwind v4 + shadcn/ui | Node/Express backend | Supabase (Postgres + Auth + Edge Functions) | ElevenLabs Conversational AI | Twilio telephony (+ Exotel/VoBiz adapters for India)

## Local Development

### Frontend

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Backend

```bash
cd backend
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY at minimum
npm install
npm start
```

Runs on port 3000 by default. Background workers (dialer, retry, billing rollup, lease sweeper, outbound webhooks, call scheduler) run as a separate process: `npm run start:workers`.

### Git hooks

One-time per clone — enables the pre-push docs-drift check (`scripts/check-doc-drift.mjs`):

```bash
git config core.hooksPath .githooks
```

### Database

Migrations live in `supabase/migrations/`. Applied via Supabase dashboard or MCP tooling.

## Project Structure

```text
src/            Frontend (React + Vite)
backend/        API server + workers (Node + Express)
supabase/       Migrations + Edge Functions
docs/           Specs and implementation plans
```

## Documentation

See [`docs/README.md`](./docs/README.md) for the full specification index.

## Tests

```bash
cd backend && npm test
```

Runs invariant tests covering consent gates, billing, state machines, and webhook signature verification.
