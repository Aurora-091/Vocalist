/**
 * ⚠️ DEPRECATED — duplicate provider tree.
 *
 * The canonical voice-provider abstraction lives at
 * `backend/src/providers/voice/`. This folder
 * (`backend/src/services/providers/`) is the second copy that exists due
 * to a prior merge, and is scheduled for deletion in PR #9 (workstream
 * 1.1 of the Phase-1 plan). When that ships:
 *   - this file + its sibling providers (vapi/retell/pipecat) are removed
 *   - call.service.js + agent.service.js import from
 *     `backend/src/providers/voice/factory.js` instead
 *
 * Do NOT add new consumers of this folder. New runtime work goes through
 * `backend/src/providers/voice/factory.js#buildVoiceProvider`.
 *
 * See `backend/src/providers/voice/README.md` for the full architecture
 * and `docs/implementation-plan-phase-1.md` (PR 1.1) for the
 * consolidation plan.
 */
class VoiceProvider {
  constructor({ orgId, config = {} } = {}) {
    this.orgId = orgId;
    this.config = config;
  }

  static get name() { throw new Error("name not implemented"); }

  // Agent Management
  async createAgent(_agent, _systemPrompt) { throw new Error("createAgent not implemented"); }
  async updateAgent(_agent, _systemPrompt) { throw new Error("updateAgent not implemented"); }
  async deleteAgent(_providerRef) { throw new Error("deleteAgent not implemented"); }

  // Telephony
  async startOutboundCall(_args) { throw new Error("startOutboundCall not implemented"); }
  async endCall(_providerCallId) { throw new Error("endCall not implemented"); }
  async assignPhoneNumber(_args) { throw new Error("assignPhoneNumber not implemented"); }

  // Call state & Webhooks
  async syncCall(_providerCallId) { throw new Error("syncCall not implemented"); }
  async handleWebhook(_req) { throw new Error("handleWebhook not implemented"); }
  async getUsage(_providerCallId) { throw new Error("getUsage not implemented"); }

  // Health
  async ping() { return { ok: true }; }
}

module.exports = { VoiceProvider };
