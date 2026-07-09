# Issue: ElevenLabs ConvAI WebSocket Closes Unexpectedly

**Status:** Resolved (Fixed in [1.16.13])  
**Priority:** High  
**Reported:** 2026-07-09  
**Component:** Frontend (React + Vite) / ElevenLabs SDK Integration

---

## Problem Summary

After successfully connecting to the ElevenLabs Conversational AI WebSocket (confirmed by `101 Switching Protocols`), the connection closes unexpectedly. The SDK then continues attempting to send `user_audio_chunk` messages, producing repeated console errors:

```
WebSocket is already in CLOSING or CLOSED state.
```

The backend session creation succeeds, the signed URL is valid, and the WebSocket handshake completes successfully. The issue occurs after the connection is established, not during setup.

---

## Files Modified in This Change Set

| File | Change |
|------|--------|
| `package.json` | `@11labs/react` replaced with `@elevenlabs/react` (v1.9.1) |
| `src/main.tsx` | Added `<ConversationProvider>` wrapper around entire app |
| `src/components/onboarding/ConversationPanel.tsx` | Migrated from `@11labs/react` to `@elevenlabs/react` |
| `src/components/WebTestPanel.tsx` | Migrated from `@11labs/react` to `@elevenlabs/react` |
| `backend/src/modules/agents/agents.routes.js` | Added self-healing agent recreation on 404, expanded agent SELECT to `*` |
| `backend/src/modules/agents/agent.service.js` | Refactored updateAgent sync logic with proper variable scoping |
| `backend/src/providers/voice/elevenlabs.provider.js` | Added `auth: { enable_auth: true }` to the agent payload to explicitly enable authenticated sessions on the voice provider side. |

---

## Investigation Findings

### 1. ✅ React Strict Mode — CONFIRMED ACTIVE

**File:** `src/main.tsx`, line 53

```tsx
<React.StrictMode>
```

React Strict Mode is **enabled**. In development mode, StrictMode intentionally double-invokes:

- Component function bodies (including hooks)
- State initializers
- Reducers
- `useEffect` cleanup and re-run

**Impact on `useConversation` hook:**

Both `ConversationPanel.tsx` and `WebTestPanel.tsx` call `useConversation()` at the component level (lines 37-63 and 41-66 respectively). With StrictMode:

1. The component function runs → `useConversation()` initializes instance A
2. StrictMode triggers a second invocation → `useConversation()` initializes instance B
3. Instance A's effects run → WebSocket or internal state set up
4. StrictMode cleans up instance A → effects cleanup runs
5. Instance B's effects run → second WebSocket or internal state set up

**The `@elevenlabs/react` SDK's `useConversation` hook may not be designed to handle double-initialization.** This can cause:

- Two internal WebSocket connections being managed
- Conflicting internal state between the two instances
- One instance closing the WebSocket that the other instance is using

**Severity:** HIGH — This is the most likely root cause.

---

### 2. ⚠️ Duplicate `startSession()` — LOW RISK (User-Initiated)

Both components call `startSession()` only inside `handleStart()`, which is triggered by a user button click:

```tsx
// ConversationPanel.tsx line 114
await conversation.startSession({ signedUrl: signed_url });

// WebTestPanel.tsx line 116
await conversation.startSession({ signedUrl: signed_url });
```

Since this is user-initiated, it cannot be called twice by accident. **However**, if StrictMode causes the `useConversation` hook to create two internal instances, the `startSession()` call might only affect one instance while the other remains in an uninitialized or half-initialized state.

---

### 3. ⚠️ Cleanup Does NOT End Session — MISSING

**File:** `ConversationPanel.tsx`, lines 91-93

```tsx
useEffect(() => {
  return () => stopTimer();
}, [stopTimer]);
```

**File:** `WebTestPanel.tsx`, lines 94-96

```tsx
useEffect(() => {
  return () => stopTimer();
}, [stopTimer]);
```

The cleanup effect **only stops the timer**. It does **NOT** call:

- `conversation.endSession()`
- `conversation.disconnect()`
- Any SDK cleanup method

**Problem:** When StrictMode unmounts the component (step 4 in the double-mount cycle), the conversation session is **not** properly cleaned up. The SDK's internal WebSocket may remain open or enter a half-closed state. When the component remounts and the user starts a new session, the old WebSocket may interfere.

**Additionally:** The `@elevenlabs/react` SDK's `ConversationProvider` wraps the entire app in `main.tsx`. When the `ConversationProvider` unmounts (which shouldn't happen in normal flow, but could during HMR or StrictMode), it may clean up all active conversations, including the one currently in use.

---

### 4. ⚠️ No Status Check Before Operations — MISSING

Neither component checks `conversation.getStatus()` or `conversation.isConnected()` before:

- Starting a session
- Ending a session
- Any other operations

The `startTimer` callback (line 68-76 in ConversationPanel.tsx) calls `conversation.endSession()` when the max duration is reached, **without checking if the session is still active**:

```tsx
const startTimer = useCallback(() => {
  setElapsed(0);
  timerRef.current = setInterval(() => {
    setElapsed((prev) => {
      if (prev + 1 >= MAX_DURATION_SEC) {
        conversation.endSession();  // No status check!
        return prev + 1;
      }
      return prev + 1;
    });
  }, 1000);
}, [conversation]);
```

**Problem:** If the WebSocket has already closed (for any reason), calling `endSession()` on an already-closed session may cause the SDK to attempt operations on the closed WebSocket, producing the "WebSocket is already in CLOSING or CLOSED state" error.

---

### 5. ✅ PATCH /calls Endpoint — NOT THE ISSUE

**File:** `backend/src/modules/calls/calls.routes.js`, lines 211-229

```js
router.patch("/:id", ... asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase
    .from("calls")
    .update({ 
      conversation_id: req.body.conversation_id, 
      status: "in_progress", 
      started_at: new Date().toISOString() 
    })
    .eq("id", req.params.id)
    .eq("org_id", req.auth.orgId)
    .select("id")
    .maybeSingle();
  // ...
}));
```

This endpoint **only**:
- Sets `conversation_id` (linking the call record to the ElevenLabs conversation)
- Updates `status` to `"in_progress"`
- Sets `started_at` timestamp

It does **NOT**:
- End the call
- Change status to `"completed"` or `"failed"`
- Invalidate the WebSocket
- Make any external API calls

**Verdict:** This endpoint is safe and does not contribute to the WebSocket closure.

---

### 6. ⚠️ Signed URL Reuse — LOW RISK

Each call to `handleStart()` fetches a fresh signed URL from the backend:

```tsx
const { signed_url, call_id } = await api.post<{...}>(
  `/v1/agents/${agentId}/web-session`
);
pendingCallIdRef.current = call_id ?? null;
await conversation.startSession({ signedUrl: signed_url });
```

**However**, if StrictMode causes the component to unmount and remount, and the user had already started a session before the unmount, the old signed URL might still be active in the SDK's internal state. When the component remounts and the user clicks "Start" again, a new signed URL is fetched, but the old one might not be properly invalidated.

---

### 7. 🔴 Missing Close Event Logging — CRITICAL GAP

**File:** `ConversationPanel.tsx`, lines 48-53

```tsx
onDisconnect: () => {
  setPhase("ended");
  stopTimer();
  onSessionEnd?.();
  captureEvent("web_test_ended", { agent_id: agentId, duration_sec: elapsed });
},
```

**File:** `WebTestPanel.tsx`, lines 52-56

```tsx
onDisconnect: () => {
  setPhase("ended");
  stopTimer();
  captureEvent("web_test_ended", { agent_id: agentId, duration_sec: elapsed });
},
```

The `onDisconnect` callback does **not** log the WebSocket close event details:

- `event.code` (e.g., 1000, 1006, 1008, 1011)
- `event.reason`
- `event.wasClean`

**Without this information, it is impossible to determine why the WebSocket is closing.** Different close codes indicate different problems:

| Code | Meaning | Possible Cause |
|------|---------|----------------|
| 1000 | Normal closure | Intentional endSession() called |
| 1006 | Abnormal closure | Network issue, or server closed without close frame |
| 1008 | Policy violation | Invalid message, auth issue |
| 1011 | Internal error | Server-side error |

---

### 8. 🔴 `@11labs/react` → `@elevenlabs/react` Migration — POTENTIAL BREAKAGE

The migration from `@11labs/react` (v0.2.0) to `@elevenlabs/react` (v1.9.1) is a **major version jump** with a **different package name**. Key differences:

| Aspect | `@11labs/react` | `@elevenlabs/react` |
|--------|-----------------|---------------------|
| Version | 0.2.0 | 1.9.1 |
| Package | Deprecated/legacy | Current official SDK |
| Provider | Not required | `ConversationProvider` required |
| Hook API | `useConversation()` | `useConversation()` (may differ) |

**The `ConversationProvider` was added to `main.tsx`** (line 50, 57):

```tsx
import { ConversationProvider } from "@elevenlabs/react";

// ...
<ConversationProvider>
  <AnalyticsLoader />
  <ErrorBoundary>
    {/* ... */}
  </ErrorBoundary>
</ConversationProvider>
```

**Potential issues:**
- The new SDK may have different internal WebSocket management
- The `ConversationProvider` may have its own lifecycle that interacts with StrictMode differently
- The `useConversation` hook API may have changed (different return values, different method signatures)
- The new SDK may be more aggressive about closing idle connections

---

### 9. ⚠️ Stale Closure in `startTimer` — MEDIUM RISK

**File:** `ConversationPanel.tsx`, line 79

```tsx
const startTimer = useCallback(() => {
  setElapsed(0);
  timerRef.current = setInterval(() => {
    setElapsed((prev) => {
      if (prev + 1 >= MAX_DURATION_SEC) {
        conversation.endSession();  // <-- captured in closure
        return prev + 1;
      }
      return prev + 1;
    });
  }, 1000);
}, [conversation]);
```

The `conversation` object is in the dependency array of `useCallback`. If `useConversation()` returns a **new object reference on every render** (which is common for hooks that return state objects), then:

1. `startTimer` is recreated on every render
2. The timer interval captures the `conversation` reference at the time `startTimer` was called
3. If the component re-renders, the timer still holds the old `conversation` reference
4. When the timer fires `conversation.endSession()`, it may be calling on a stale/closed session

**This could cause `endSession()` to be called on an already-closed session, triggering the "WebSocket is already in CLOSING or CLOSED state" error.**

---

### 10. ⚠️ Inline Callbacks in `useConversation` — MEDIUM RISK

**File:** `ConversationPanel.tsx`, lines 37-63

```tsx
const conversation = useConversation({
  onConnect: () => { /* ... */ },
  onDisconnect: () => { /* ... */ },
  onError: (message: string) => { /* ... */ },
  onMessage: ({ message, source }) => { /* ... */ },
});
```

The callbacks are defined **inline** as object literals. This means:

1. On every render, new callback function references are created
2. The `useConversation` hook may re-subscribe to events on every render
3. This could cause duplicate event handlers or memory leaks
4. If the hook internally creates new WebSocket connections on re-subscription, this could cause multiple connections

**Best practice:** Use `useCallback` for the callbacks or use `useMemo` for the options object.

---

## Root Cause Analysis

### Most Likely Root Cause: React StrictMode Double-Mounting

The chain of events:

```
1. React.StrictMode is enabled in main.tsx (line 53)
2. OnboardingModal opens → ConversationPanel mounts
3. StrictMode: Component function runs → useConversation() initializes instance A
4. StrictMode: Component function runs AGAIN → useConversation() initializes instance B
5. Instance A's effects run → SDK sets up internal state/WebSocket
6. StrictMode: Instance A's cleanup runs → SDK may partially clean up
7. Instance B's effects run → SDK sets up internal state/WebSocket again
8. User clicks "Start" → startSession() called
9. SDK creates WebSocket connection (visible as 101 Switching Protocols)
10. WebSocket connects successfully
11. Something triggers close (possibly SDK internal state confusion from double-init)
12. WebSocket closes
13. SDK continues trying to send audio → "WebSocket is already in CLOSING or CLOSED state"
```

### Contributing Factors

1. **No cleanup of conversation session on unmount** — When StrictMode unmounts the component, the session is not ended
2. **No close event logging** — Cannot determine why the WebSocket is closing
3. **Stale closure in timer** — May call `endSession()` on wrong conversation instance
4. **Inline callbacks** — May cause re-subscription issues
5. **SDK migration** — New SDK may have different behavior with StrictMode

---

## Recommended Fixes

### Fix 1: Remove or Handle StrictMode (Immediate)

**Option A:** Remove StrictMode in development (not recommended for best practices)

**Option B:** Move `ConversationPanel` outside of StrictMode's influence by rendering it in a portal or separate root

**Option C (Recommended):** Make the component resilient to double-mounting:

```tsx
// Use a ref to track if session has been initialized
const initializedRef = useRef(false);

useEffect(() => {
  // Skip the StrictMode double-invocation cleanup
  // This runs on actual unmount only
  return () => {
    if (initializedRef.current) {
      conversation.endSession();
    }
  };
}, [conversation]);
```

### Fix 2: Add Proper Cleanup (Critical)

Add cleanup that ends the conversation session on unmount:

```tsx
useEffect(() => {
  return () => {
    stopTimer();
    if (conversation.getStatus() === "connected") {
      conversation.endSession();
    }
  };
}, [conversation, stopTimer]);
```

### Fix 3: Add Close Event Logging (Critical)

Log WebSocket close details in the `onDisconnect` callback:

```tsx
onDisconnect: (event?: { code?: number; reason?: string; wasClean?: boolean }) => {
  console.log("WebSocket closed:", {
    code: event?.code,
    reason: event?.reason,
    clean: event?.wasClean,
  });
  setPhase("ended");
  stopTimer();
  onSessionEnd?.();
  captureEvent("web_test_ended", { agent_id: agentId, duration_sec: elapsed });
},
```

### Fix 4: Stabilize `useConversation` Callbacks (Recommended)

Use `useCallback` for callbacks to prevent unnecessary re-subscriptions:

```tsx
const onConnect = useCallback(() => {
  setPhase("active");
  setError(null);
  onSessionStart?.();
  captureEvent("web_test_started", { agent_id: agentId, agent_name: agentName });
  const convId = conversation.getId();
  if (pendingCallIdRef.current && convId) {
    api.patch(`/v1/calls/${pendingCallIdRef.current}`, { conversation_id: convId }).catch(() => {});
  }
}, [agentId, agentName, onSessionStart, conversation]);

const conversation = useConversation({
  onConnect,
  onDisconnect,
  onError,
  onMessage,
});
```

### Fix 5: Check Status Before Operations (Recommended)

Add status checks before any SDK operations:

```tsx
const handleEnd = async () => {
  if (conversation.getStatus() === "connected") {
    await conversation.endSession();
  }
  setPhase("ended");
  stopTimer();
};
```

### Fix 6: Stabilize Timer Closure (Recommended)

Use a ref for the conversation object to avoid stale closures:

```tsx
const conversationRef = useRef(conversation);
conversationRef.current = conversation;

const startTimer = useCallback(() => {
  setElapsed(0);
  timerRef.current = setInterval(() => {
    setElapsed((prev) => {
      if (prev + 1 >= MAX_DURATION_SEC) {
        conversationRef.current.endSession();
        return prev + 1;
      }
      return prev + 1;
    });
  }, 1000);
}, []); // No dependency on conversation
```

---

## Reproduction Steps

1. Run the app in development mode (StrictMode active)
2. Open the OnboardingModal
3. Complete steps 1-3 (Template, Business, Voice)
4. Click "Continue" on the Voice step (this creates the agent and navigates to the Test step)
5. On the Test step, click "Start conversation"
6. Observe:
   - WebSocket connects (101 Switching Protocols)
   - Audio is captured
   - After a few seconds, WebSocket closes
   - Console shows repeated "WebSocket is already in CLOSING or CLOSED state"

---

## Environment

- **Frontend:** React 18+ with Vite
- **SDK:** `@elevenlabs/react` v1.9.1 (migrated from `@11labs/react` v0.2.0)
- **Backend:** Node.js with Express
- **Mode:** Development (StrictMode enabled)
- **Browser:** Chrome (latest)

---

## Related Files

| File | Path |
|------|------|
| Main entry with StrictMode | `src/main.tsx` |
| Conversation panel (onboarding) | `src/components/onboarding/ConversationPanel.tsx` |
| Web test panel | `src/components/WebTestPanel.tsx` |
| Onboarding modal (parent) | `src/components/onboarding/OnboardingModal.tsx` |
| Web-session endpoint | `backend/src/modules/agents/agents.routes.js` |
| Call PATCH endpoint | `backend/src/modules/calls/calls.routes.js` |
| Agent service | `backend/src/modules/agents/agent.service.js` |
| ElevenLabs provider | `backend/src/providers/voice/elevenlabs.provider.js` |