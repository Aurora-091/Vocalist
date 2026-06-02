```
aurora-backend/
│
├── src/
│
├── app/
│   ├── server.ts
│   ├── app.ts
│   ├── routes.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── org.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── error.middleware.ts
│   │
│   └── config/
│       ├── env.ts
│       ├── supabase.ts
│       ├── stripe.ts
│       ├── redis.ts
│       └── logger.ts
│
├── modules/
│
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.validator.ts
│   │   └── dto/
│
│   ├── organizations/
│   │
│   ├── users/
│   │
│   ├── agents/
│   │   ├── agent.controller.ts
│   │   ├── agent.service.ts
│   │   ├── agent.repository.ts
│   │   ├── agent.routes.ts
│   │   └── dto/
│
│   ├── knowledge-base/
│   │
│   ├── contacts/
│   │
│   ├── consent/
│   │   ├── consent.controller.ts
│   │   ├── consent.service.ts
│   │   ├── consent.repository.ts
│   │   ├── consent-gate.ts
│   │   ├── optout.ts
│   │   ├── consent.routes.ts
│   │   └── tests/
│
│   ├── campaigns/
│   │   ├── campaign.controller.ts
│   │   ├── campaign.service.ts
│   │   ├── campaign.repository.ts
│   │   ├── campaign.routes.ts
│   │   ├── scheduler.service.ts
│   │   ├── dialer.service.ts
│   │   ├── state-machine.ts
│   │   └── tests/
│
│   ├── calls/
│   │   ├── call.controller.ts
│   │   ├── call.service.ts
│   │   ├── call.repository.ts
│   │   ├── call.routes.ts
│   │   ├── transcript.service.ts
│   │   └── recording.service.ts
│
│   ├── integrations/
│   │   ├── integration.controller.ts
│   │   ├── integration.service.ts
│   │   ├── integration.repository.ts
│   │   └── providers/
│   │
│   │       ├── shopify/
│   │       ├── calcom/
│   │       ├── google-calendar/
│   │       ├── outlook/
│   │       ├── hubspot/
│   │       ├── salesforce/
│   │       └── zapier/
│
│   ├── analytics/
│   │
│   ├── billing/
│   │   ├── billing.controller.ts
│   │   ├── billing.service.ts
│   │   ├── metering.ts
│   │   ├── usage-ledger.service.ts
│   │   └── stripe.service.ts
│
│   ├── webhooks/
│   │   ├── webhook.controller.ts
│   │   ├── webhook.service.ts
│   │   ├── handlers/
│   │   │
│   │   ├── stripe/
│   │   ├── vapi/
│   │   ├── shopify/
│   │   └── twilio/
│   │
│   └── audit/
│
│
├── providers/
│
│   ├── voice/
│   │   ├── interface.ts
│   │   ├── managed-provider/
│   │   │   └── vapi.provider.ts
│   │   │
│   │   ├── retell/
│   │   │   └── retell.provider.ts
│   │   │
│   │   └── self-hosted/
│   │       └── pipecat.provider.ts
│   │
│   └── crm/
│       ├── interface.ts
│       ├── hubspot.provider.ts
│       └── salesforce.provider.ts
│
│
├── db/
│
│   ├── migrations/
│   ├── schema/
│   │   ├── orgs.ts
│   │   ├── users.ts
│   │   ├── agents.ts
│   │   ├── contacts.ts
│   │   ├── campaigns.ts
│   │   ├── calls.ts
│   │   ├── billing.ts
│   │   └── integrations.ts
│   │
│   ├── repositories/
│   └── rls/
│       ├── orgs.sql
│       ├── contacts.sql
│       ├── campaigns.sql
│       └── calls.sql
│
│
├── workers/
│
│   ├── campaign-worker/
│   │   ├── dialer.worker.ts
│   │   ├── retry.worker.ts
│   │   └── voicemail.worker.ts
│   │
│   ├── billing-worker/
│   │
│   ├── webhook-worker/
│   │
│   └── cleanup-worker/
│
│
├── queue/
│   ├── queue.ts
│   ├── campaign.queue.ts
│   ├── billing.queue.ts
│   └── webhook.queue.ts
│
│
├── services/
│
│   ├── realtime.service.ts
│   ├── storage.service.ts
│   ├── encryption.service.ts
│   ├── audit.service.ts
│   ├── notification.service.ts
│   ├── cache.service.ts
│   ├── feature-flag.service.ts
│   └── metrics.service.ts
│
│
├── utils/
│
│   ├── logger.ts
│   ├── date.ts
│   ├── timezone.ts
│   ├── phone.ts
│   ├── crypto.ts
│   ├── retry.ts
│   ├── idempotency.ts
│   ├── validation.ts
│   └── constants.ts
│
│
├── tests/
│
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   ├── factories/
│   └── invariants/
│       ├── consent-invariant.test.ts
│       ├── optout-propagation.test.ts
│       ├── idempotency.test.ts
│       ├── webhook-sig.test.ts
│       └── rls.test.ts
│
│
├── docs/
├── scripts/
├── docker/
├── .github/
│   ├── workflows/
│   └── CODEOWNERS
│
└── package.json
```