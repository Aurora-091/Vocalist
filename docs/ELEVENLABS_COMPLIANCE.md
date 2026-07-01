# ElevenLabs API Compliance Audit

**Repo:** `vocalist/backend`  
**Audited:** 2026-06-29  
**Auditor:** Runable AI  
**Provider File:** `backend/src/providers/voice/elevenlabs.provider.js`  
**EL API Version baseline:** June 2026 (CAI 2.0, new pricing tiers, breaking InteractionBudget enum, tool type requirement)

---

## Summary

| ID | Severity | Method / Field | Issue | Status |
|----|----------|---------------|-------|--------|
| EL-001 | 🔴 BREAKING | `interaction_budget` placement | Was inside `safety` key at `conversation_config` root — EL ignores it there | ✅ Fixed |
| EL-002 | 🔴 BREAKING | `knowledge_base` format | Passed raw string IDs — EL expects `[{ type: "id", id: "..." }]` | ✅ Fixed |
| EL-003 | 🔴 BREAKING | Tool `type` field missing | EL June 2026 requires `type: "webhook"` on every tool object | ✅ Fixed |
| EL-004 | 🟠 SILENT | `InteractionBudget.async` deprecated | `async` enum value removed in June 2026 — was previously set, now `10_minutes` | ✅ Fixed (DEC-009) |
| EL-005 | 🟡 WATCH | LLM pass-through cost | `gpt-4o-mini` → `gemini-2.5-flash` (~60% cost reduction) | ✅ Fixed (DEC-009) |
| EL-006 | 🟡 WATCH | Outbound call endpoint format | `POST /v1/convai/twilio/outbound-call` — correct, but `conversation_initiation_client_data` nesting needs verification | ⚠️ Verify |
| EL-007 | 🟡 INFO | `recording_url` auth-gated | EL recording URLs require `xi-api-key` — breaks public playback | ⚠️ See IG-007 |
| EL-008 | 🟢 COMPLIANT | All CRUD endpoints | `POST /create`, `PATCH /:id`, `DELETE /:id`, `GET /:id` | ✅ No action |
| EL-009 | 🟢 COMPLIANT | Auth header | `xi-api-key` used correctly | ✅ No action |
| EL-010 | 🟢 COMPLIANT | Knowledge base ingestion | `POST /v1/convai/knowledge-base` multipart with `name` + `file`/`url` | ✅ No action |
| EL-011 | 🟢 COMPLIANT | Phone number import | `POST /v1/convai/phone-numbers` with `provider: "twilio"` | ✅ No action |
| EL-012 | 🟢 COMPLIANT | Phone number assignment | `PATCH /v1/convai/phone-numbers/:id` with `agent_id` | ✅ No action |
| EL-013 | 🟢 COMPLIANT | `dynamic_variables` | Placed inside `conversation_initiation_client_data` on outbound call | ✅ No action |

---

## Detailed Findings

---

### EL-001 — 🔴 `interaction_budget` in Wrong Location

**Method:** `_buildAgentPayload()`  
**EL spec:** `conversation_config.agent.interaction_budget`  
**What was sent:**

```json
{
  "conversation_config": {
    "agent": { ... },
    "tts": { ... },
    "safety": {
      "interaction_budget": { "total_budget": "10_minutes" }
    }
  }
}
```

`safety` is not a valid key inside `conversation_config`. ElevenLabs silently ignores unknown top-level keys — the budget was **never enforced**. A runaway call could run indefinitely, burning concurrency slots and COGS.

**Fix applied:**

```json
{
  "conversation_config": {
    "agent": {
      "prompt": { ... },
      "first_message": "...",
      "language": "en",
      "interaction_budget": { "total_budget": "10_minutes" }
    },
    "tts": { "voice_id": "..." }
  }
}
```

**Commit:** `952b7c4` — `fix: EL June 2026 API compliance — interaction_budget location, kb format, tool type field`

---

### EL-002 — 🔴 `knowledge_base` Sent as Raw String Array

**Method:** `_buildAgentPayload()` → `promptConfig.knowledge_base`  
**EL spec:** `prompt.knowledge_base` must be an array of objects: `[{ "type": "id", "id": "kb_xxx" }]`

**What was sent:**
```js
promptConfig.knowledge_base = agent.knowledge_base_ids;
// → ["kb_abc123", "kb_def456"]  ← wrong, EL rejects this
```

**Result:** Agent create/update would fail with a 422 or silently drop the KB. Agents would have no knowledge grounding despite the user uploading documents.

**Fix applied:**
```js
promptConfig.knowledge_base = agent.knowledge_base_ids.map((id) =>
  typeof id === "string" ? { type: "id", id } : id
);
// → [{ type: "id", id: "kb_abc123" }, ...]  ← correct
```

The `typeof` guard handles the case where the array already contains proper objects (e.g. from a future migration that stores them pre-formatted).

**Commit:** `952b7c4`

---

### EL-003 — 🔴 Tools Missing `type: "webhook"` Field

**Method:** `_resolveTools()`  
**EL spec (June 2026):** Every tool object must include `"type": "webhook"` as the first field.

**What was sent:**
```json
{
  "name": "get_available_slots",
  "description": "Fetch available appointment slots",
  "method": "GET",
  "url": "https://api.weeber.ai/v1/tools/calendar/slots"
}
```

**Result:** EL agent create/update with tools → `422 Unprocessable Entity`. Agents that include clinic tools (booking, reminders, recall) would **fail to sync entirely**. EL silently accepted this in older API versions — breaking change in June 2026.

**Fix applied:**
```js
const resolved = {
  type: tool.type || "webhook",  // explicit, with fallback
  name: tool.name,
  description: tool.description || "",
  // ... rest of fields
};
```

**Commit:** `952b7c4`

---

### EL-004 — 🟠 `InteractionBudget.async` Deprecated (Previously Fixed)

**Status:** ✅ Fixed in DEC-009 (same session as EL-001)

The `async` enum value was removed from `InteractionBudget` in the June 2026 EL API update. It was previously set in `safety.interaction_budget.total_budget: "async"`. This would return a `400` on any agent create/update.

Replaced with `"10_minutes"` — appropriate for clinic calls (bookings ~3-5 min, reminders ~1-2 min).

**Valid enum values (June 2026):**
| Value | Duration |
|-------|----------|
| `5_minutes` | 5 min hard cutoff |
| `10_minutes` | 10 min hard cutoff ← **current** |
| `1_hour` | 60 min hard cutoff |
| *(removed)* `async` | — deprecated, breaks on creation |

**Recommendation:** Consider `5_minutes` for reminder + recall agents (shorter calls). Use `10_minutes` only for booking + triage agents where the conversation can run longer.

---

### EL-005 — 🟡 LLM Pass-Through Switched to Gemini 2.5 Flash (Previously Fixed)

**Status:** ✅ Fixed in DEC-009

ElevenLabs now charges LLM pass-through fees separately (~`$0.0012/min` for Gemini Flash vs `$0.003/min` for GPT-4o-mini). `_buildAgentPayload()` now sends:

```json
"llm": "gemini-2.5-flash"
```

Cost impact: ~60% reduction in per-call LLM cost. No other payload changes needed — EL accepts the model identifier string directly.

---

### EL-006 — ⚠️ Outbound Call `conversation_initiation_client_data` — Verify Nesting

**Method:** `startCall()`  
**Status:** Likely correct, but needs live verification.

Current payload:
```json
{
  "agent_id": "...",
  "agent_phone_number_id": "...",
  "to_number": "+91...",
  "conversation_initiation_client_data": {
    "lease_token": "...",
    "call_id": "...",
    "org_id": "...",
    "agent_id": "...",
    "from_number": "...",
    "dynamic_variables": { "patient_name": "Rahul", ... }
  }
}
```

**Potential issue:** EL June 2026 may require `dynamic_variables` to be nested under a `custom_llm_extra_body` or `metadata` key depending on agent config. Confirm against live call logs — if `dynamic_variables` aren't being injected into the agent prompt, this is why.

**How to verify:** After a live call, pull the conversation from EL dashboard → inspect if dynamic vars appear in the transcript. If not, the nesting is wrong.

---

### EL-007 — ⚠️ Recording URLs Are Auth-Gated (Tracked as IG-007)

ElevenLabs conversation recording URLs require `xi-api-key` authentication. Storing the raw URL and attempting to play it in the dashboard's call log will fail for end users (who don't have the API key).

**Pattern to fix:**
1. Store only a `recording_ref` (the EL conversation ID) in `calls.recording_ref`
2. When the UI requests playback, the backend fetches the recording via authenticated call and either:
   - Streams it as a proxied response
   - Generates a short-lived signed URL (if EL provides one)

**This is tracked separately as IG-007** in `INTEGRATION_GAPS.md`. Not fixed in this session.

---

## What Is Compliant

### Endpoints — All Correct

| Operation | Endpoint | Method |
|-----------|----------|--------|
| Create agent | `/v1/convai/agents/create` | POST |
| Update agent | `/v1/convai/agents/:agent_id` | PATCH |
| Delete agent | `/v1/convai/agents/:agent_id` | DELETE |
| Get agent | `/v1/convai/agents/:agent_id` | GET |
| List phone numbers | `/v1/convai/phone-numbers` | GET |
| Import phone number | `/v1/convai/phone-numbers` | POST |
| Assign agent to number | `/v1/convai/phone-numbers/:phone_number_id` | PATCH |
| Outbound call | `/v1/convai/twilio/outbound-call` | POST |
| Upload KB document | `/v1/convai/knowledge-base` | POST (multipart) |

### Auth — Correct
`xi-api-key` header on every request. API key resolved from `config.api_key` → `ELEVENLABS_API_KEY` env fallback. Correct.

### Agent Payload Structure — Correct (post-fixes)
```json
{
  "name": "Weeber Booking Agent",
  "conversation_config": {
    "agent": {
      "prompt": {
        "prompt": "You are a clinic booking assistant...",
        "llm": "gemini-2.5-flash",
        "temperature": 0.5,
        "tools": [
          {
            "type": "webhook",
            "name": "get_available_slots",
            "description": "...",
            "method": "GET",
            "url": "https://api.weeber.ai/v1/tools/calendar/slots",
            "query_parameters": [ ... ]
          }
        ],
        "knowledge_base": [
          { "type": "id", "id": "kb_abc123" }
        ]
      },
      "first_message": "Hello! How can I help you today?",
      "language": "en",
      "interaction_budget": {
        "total_budget": "10_minutes"
      }
    },
    "tts": {
      "voice_id": "21m00Tcm4TlvDq8ikWAM"
    }
  },
  "platform_settings": {
    "data_collection": [ ... ],
    "evaluation_criteria": [ ... ]
  }
}
```

### Knowledge Base Ingestion — Correct
```js
// Website source
formData.append("name", "Clinic FAQ");
formData.append("url", "https://clinic.example.com/faq");

// Document source
formData.append("name", "Services Brochure");
formData.append("file", blob, "services.pdf");
```

---

## EL June 2026 New Features — Not Yet Used

These features shipped in the June 2026 EL update. None are breaking for current code, but worth evaluating:

| Feature | What It Does | Weeber Relevance |
|---------|-------------|-----------------|
| **CAI 2.0 turn-taking** | Better interruption handling, multi-language auto-detect | No code change needed — automatic for all agents |
| **Per-agent topic discovery** | EL auto-surfaces topics from conversation history | Could feed `call_topics` field in analytics — future |
| **Background sound** | Ambient audio during calls (office noise, music) | Low priority, nice UX for clinic waiting-room feel |
| **Dynamic variables in tools** | Variables can be injected into tool URL/body at call time | Already partially supported via `dynamic_variables` — needs explicit tool param binding |
| **Branch versioning** | Agent versions like git branches | Useful for A/B testing agent scripts — V2 feature |
| **Speech Engine (BYO-LLM)** | Use EL only for TTS layer, own LLM + STT | This is the Phase 3 architecture in DEC-010 — do not start before ARR > ₹20L/month |

---

## Open Items

| ID | Priority | Action |
|----|----------|--------|
| EL-006 | HIGH | Verify `dynamic_variables` injection via live call test — check transcript in EL dashboard |
| EL-007 / IG-007 | MEDIUM | Build recording proxy endpoint — store `recording_ref`, serve via `/api/calls/:id/recording` |
| EL-004 follow-up | LOW | Consider `5_minutes` for reminder + recall agents to reduce runaway call risk |
| CAI 2.0 dynamic vars in tools | LOW | Bind `configurable_variables` (once migrated) to tool URL params at sync time |

---

## Files Changed This Session

| File | Change | Commit |
|------|--------|--------|
| `backend/src/providers/voice/elevenlabs.provider.js` | EL-001: moved `interaction_budget` to correct location | `952b7c4` |
| `backend/src/providers/voice/elevenlabs.provider.js` | EL-002: fixed `knowledge_base` to object array format | `952b7c4` |
| `backend/src/providers/voice/elevenlabs.provider.js` | EL-003: added `type: "webhook"` to all tool objects | `952b7c4` |

---

*Last updated: 2026-06-29 — Runable AI audit*
