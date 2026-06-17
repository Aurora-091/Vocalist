# Decisions Log

This document tracks all major product, architecture, and technology decisions made on the Weeber platform.

---

## DEC-001: Pivot to Weeber Branding
* **Date**: 2026-06-12
* **Status**: Accepted
* **Context**: The product was initially scaffolded under the name **Aurora**. Due to registration requirements, naming conflict resolution, and focus on the conversational nature of voice calling, the platform is rebranded to **Weeber**.
* **Decision**: All documentation, user-facing copy, metadata, and new components will use "Weeber" branding. Historical specification files in `docs/archive/` will remain untouched to preserve their original audit paths.

---

## DEC-002: Active Voice Runtime Standardized on ElevenLabs CAI
* **Date**: 2026-06-13
* **Status**: Accepted
* **Context**: We evaluated Vapi, Retell, and ElevenLabs Conversational AI (CAI). Vapi UI features would increase implementation overhead, whereas ElevenLabs CAI matches our target SMB simplicity and cost thresholds.
* **Decision**: We will use ElevenLabs CAI as our active voice provider. Vapi and Retell logic remain compiled in the backend codebase (`providers/voice/`) but are excluded from active factory instantiation.

---

## DEC-003: Supabase Auth Standardization
* **Date**: 2026-06-14
* **Status**: Accepted
* **Context**: Authentication requirements include session management, OAuth token vaults, multi-tenancy context passing, and automated onboarding schemas.
* **Decision**: We standardize on Supabase Auth. App state uses `supabase.auth.getSession()` to attach JWT Bearer tokens to internal HTTP requests, enforcing multi-tenancy at the Postgres RLS level.

---

## DEC-004: Admin Dashboard Subdomain Strategy
* **Date**: 2026-06-15
* **Status**: Accepted
* **Context**: Security boundaries dictate that internal admin controls (managing user accounts, waitlist approval, billing status, platform metrics, logs review) should be insulated from normal merchant consoles.
* **Decision**: Implement the admin module at the `/admin/` frontend routing namespace, gated behind a check on `platform_role` returned from `/v1/admin/me`. Only authorized platform administrators can access these dashboard routes.

---

## DEC-005: Testing Infrastructure Integration
* **Date**: 2026-06-16
* **Status**: Accepted
* **Context**: Active UI improvements and form modifications require rapid automated validation to avoid regression checks on manual UI workflows.
* **Decision**: Adopt and configure `Vitest` and `React Testing Library` for the frontend. All verification sweeps will run `npm test` alongside standard TypeScript compiler validations.
