# living QA Edge Case Specification Sheet

This document catalogs critical system boundaries, fail-modes, and security integrations within the Weeber platform. **For every new feature or fix added to `docs/CHANGELOG.md`, a corresponding manual verification row must be added here to guide staging QA validation.**

---

## Active QA Verification Matrix

| Ref / Version | Feature / Scenario | Manual Verification Steps | Expected Outcome | Status |
|---|---|---|---|---|
| **A-1 / A-2** | Signup Auth-Orphan Recovery | 1. Create a user in Supabase `auth.users` manually using a testing email (e.g. `orphan@test.com`) but do not create a `public.users` row.<br>2. Open the browser and visit the `/signup` landing route.<br>3. Attempt to sign up using the same email `orphan@test.com`. | Instead of returning a hard "email already exists" block, the page triggers an auto-heal, maps the `public.users` and `onboarding_state` records to the existing `auth_id`, and redirects to a "recovery link sent" page. | `[x] Verified in Staging` |
| **T-6** | Telephony Purchase DB Fail Rollback | 1. Navigate to the phone numbers marketplace in the admin portal.<br>2. Trigger a mock purchase endpoint after configuring the local database write transaction to explicitly throw an error (e.g., mock constraint violation). | The database error is caught. The system invokes `incomingPhoneNumbers(sid).remove()` on the Twilio client to release the provisioned line, preventing orphan billing. | `[x] Verified in Staging` |
| **S-16** | Secure Recording Assets Storage | 1. Place an outbound voice agent test call.<br>2. Complete the call and wait for the ElevenLabs completion webhook to trigger.<br>3. Query the database to retrieve the `recording_url` value. | The URL is mapped to a secure private storage path (e.g., `org-123/call-abc.mp3`). Opening the path directly returns `403 Forbidden`, while playing from the Calls page successfully loads the audio via `createSignedUrl`. | `[x] Verified in Staging` |
| **T-3** | Concurrency Subaccount Provisioning | 1. Concurrently launch two simultaneous API requests to provision a Twilio subaccount for a newly created organization. | The Postgres advisory lock function `request_advisory_lock` forces the second transaction to wait until the first commits, yielding exactly 1 subaccount instead of duplicates. | `[x] Verified in Staging` |
| **A-4** | Daily Auth Orphan Cron Alerts | 1. Insert a mock orphan record in `auth.users`.<br>2. Manually execute the scheduled function: `SELECT public.check_auth_orphans();` | The query outputs a warning detailing the mismatched orphan ID and email, capturing it in the scheduler logs. | `[x] Verified in Staging` |
| **-** | Timezone Quiet Hours Bounds | 1. Configure the dialer test setup with quiet hours from 22:00 to 08:00.<br>2. Trigger a call batch at exactly 21:59 local timezone.<br>3. Trigger another call batch at exactly 22:00. | The 21:59 call is placed. The 22:00 call is blocked with outcome `quiet_hours` and rescheduled for the next morning business window. | `[x] Verified in Staging` |

---

## Maintenance Guidelines
* **Commit Rule**: Do not approve pull requests adding new functional routes or webhook handlers unless a corresponding manual edge-case row is added to the checklist above.
* **Release Protocol**: Before migrating production databases to a new version, a QA engineer must walk through the manual verification steps for all "Pending" items in staging and update their status to "Verified".
