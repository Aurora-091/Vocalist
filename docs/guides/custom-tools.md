# Extending Custom Tools Integration Guide 🛠️

This guide outlines how developers can write, configure, and register new tools and actions within the Weeber proxy framework.

---

## 1. Directory Structure

All tools and actions are contained under the `backend/src/modules/tools/` sub-module:

```
backend/src/modules/tools/
├── tools.middleware.js     ← Secret token authentication and tenant/org mapping
├── tools.routes.js         ← Dynamic POST routing to integration handlers
└── handlers/
    ├── shopify.tools.js    ← Shopify specific tool actions
    ├── calcom.tools.js     ← Cal.com specific tool actions
    ├── calendar.tools.js   ← Google/Outlook Calendar tool actions
    └── twilio.tools.js     ← Twilio specific tool actions
```

---

## 2. Request Routing and Authorization

Tool endpoints are accessed via the proxy path:  
`POST /v1/tools/:integration/:action`

### Required Headers
Every tool request must supply the following headers:
*   `x-weeber-secret`: Must match the system `WEEBER_TOOL_SECRET` environment variable.
*   `x-weeber-agent-id`: The UUID of the agent triggering the tool call.

### Context Resolution
The middleware [tools.middleware.js](../tools.middleware.js) validates the headers, fetches the agent row from the database, and injects context parameters directly into the request (`req`) object:
*   `req.agentId`: Resolves to agent's UUID.
*   `req.orgId`: Resolves to tenant/org UUID.
*   `req.vertical`: Resolves to current vertical (e.g. `shopify`, `real_estate`).

---

## 3. Implementing a New Tool Action

To add a new tool action:

1.  Open the relevant integration handler under `backend/src/modules/tools/handlers/` (e.g., `shopify.tools.js`).
2.  Add a new asynchronous function matching your action name:
    ```javascript
    async function my_new_action(req) {
      const { parameter1 } = req.body;
      const orgId = req.orgId; // Access resolved multi-tenant context
      
      // Perform logic or call external APIs
      return {
        status: "success",
        data: { message: `Processed ${parameter1}` }
      };
    }
    ```
3.  Export the function at the bottom of the file.
4.  The routing layer in [tools.routes.js](../tools.routes.js) will automatically map `POST /v1/tools/shopify/my_new_action` to this function.

---

## 4. ElevenLabs JSON Response Requirements

ElevenLabs Conversational AI expects clean, structured JSON payloads. Keep responses short and flat to limit speech generation latency:

*   **Avoid deep nesting**: Use key/value properties directly.
*   **Limit size**: Return only parameters relevant to the call context (avoid dumping full database entities).
*   **Handle status codes**: Always return a `200 OK` JSON payload indicating status (e.g., `{ "status": "success", "booking_id": "..." }`) rather than throwing raw text errors.
