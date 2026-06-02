const ApiError = require("../../utils/ApiError");
const { isNonEmptyString, isUuid } = require("../../utils/validators");
const { generateSystemPrompt } = require("../../utils/promptBuilder");
const {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
} = require("../../services/providers");
const agentRepository = require("./agent.repository");

const NAME_MAX_LENGTH = 120;
const VERTICAL_MAX_LENGTH = 80;
const VOICE_ID_MAX_LENGTH = 200;
const PROVIDER_REF_MAX_LENGTH = 200;

function ensureAgentId(id) {
  if (!isUuid(id)) throw ApiError.badRequest("Invalid agent id");
}

function validateString(value, field, max) {
  if (!isNonEmptyString(value)) {
    throw ApiError.badRequest(`${field} is required`);
  }
  if (max && value.trim().length > max) {
    throw ApiError.badRequest(`${field} exceeds maximum length of ${max} characters`);
  }
}

function normalizePersona(persona) {
  if (persona === undefined || persona === null) return {};
  if (typeof persona !== "object" || Array.isArray(persona)) {
    throw ApiError.badRequest("persona must be a JSON object");
  }
  if (persona.goals !== undefined && !Array.isArray(persona.goals)) {
    throw ApiError.badRequest("persona.goals must be an array of strings");
  }
  if (persona.guardrails !== undefined && !Array.isArray(persona.guardrails)) {
    throw ApiError.badRequest("persona.guardrails must be an array of strings");
  }
  if (
    persona.opening_message !== undefined &&
    persona.opening_message !== null &&
    typeof persona.opening_message !== "string"
  ) {
    throw ApiError.badRequest("persona.opening_message must be a string");
  }
  if (
    persona.identity !== undefined &&
    (typeof persona.identity !== "object" || Array.isArray(persona.identity))
  ) {
    throw ApiError.badRequest("persona.identity must be an object");
  }
  if (
    persona.tone !== undefined &&
    (typeof persona.tone !== "object" || Array.isArray(persona.tone))
  ) {
    throw ApiError.badRequest("persona.tone must be an object");
  }
  return persona;
}

async function loadOwnedAgent(id, orgId) {
  ensureAgentId(id);
  const agent = await agentRepository.findByIdInOrg(id, orgId);
  if (!agent) throw ApiError.notFound("Agent not found");
  return agent;
}

async function list({ orgId }) {
  return agentRepository.listByOrg(orgId);
}

async function getById({ orgId, id }) {
  return loadOwnedAgent(id, orgId);
}

async function create({ orgId, payload }) {
  const { name, vertical, provider, voice_id: voiceId, persona } = payload || {};

  validateString(name, "name", NAME_MAX_LENGTH);
  validateString(provider, "provider");
  validateString(voiceId, "voice_id", VOICE_ID_MAX_LENGTH);
  if (vertical !== undefined && vertical !== null && vertical !== "") {
    validateString(vertical, "vertical", VERTICAL_MAX_LENGTH);
  }
  if (!isSupportedProvider(provider)) {
    throw ApiError.badRequest(
      `Unsupported provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
  }

  const personaJson = normalizePersona(persona);

  return agentRepository.create({
    orgId,
    name: name.trim(),
    vertical: vertical ? vertical.trim() : null,
    provider,
    voiceId: voiceId.trim(),
    persona: personaJson,
  });
}

async function update({ orgId, id, payload }) {
  const agent = await loadOwnedAgent(id, orgId);
  const updates = {};
  const body = payload || {};

  if (body.name !== undefined) {
    validateString(body.name, "name", NAME_MAX_LENGTH);
    updates.name = body.name.trim();
  }
  if (body.vertical !== undefined) {
    if (body.vertical === null || body.vertical === "") {
      updates.vertical = null;
    } else {
      validateString(body.vertical, "vertical", VERTICAL_MAX_LENGTH);
      updates.vertical = body.vertical.trim();
    }
  }
  if (body.voice_id !== undefined) {
    validateString(body.voice_id, "voice_id", VOICE_ID_MAX_LENGTH);
    updates.voice_id = body.voice_id.trim();
  }
  if (body.provider_ref !== undefined) {
    if (body.provider_ref === null || body.provider_ref === "") {
      updates.provider_ref = null;
    } else {
      validateString(body.provider_ref, "provider_ref", PROVIDER_REF_MAX_LENGTH);
      updates.provider_ref = body.provider_ref.trim();
    }
  }
  if (body.persona !== undefined) {
    updates.persona = normalizePersona(body.persona);
  }
  if (body.provider !== undefined) {
    if (!isSupportedProvider(body.provider)) {
      throw ApiError.badRequest(
        `Unsupported provider. Supported: ${SUPPORTED_PROVIDERS.join(", ")}`
      );
    }
    updates.provider = body.provider;
  }

  if (Object.keys(updates).length === 0) {
    return agent;
  }

  return agentRepository.updateById({ id, orgId, patch: updates });
}

async function remove({ orgId, id }) {
  const deleted = await agentRepository.softDelete({ id, orgId });
  if (!deleted) throw ApiError.notFound("Agent not found");
  return { id: deleted.id };
}

async function updatePersona({ orgId, id, persona }) {
  await loadOwnedAgent(id, orgId);
  const personaJson = normalizePersona(persona);
  const updated = await agentRepository.updateById({
    id,
    orgId,
    patch: { persona: personaJson },
  });
  return {
    ...updated,
    system_prompt: generateSystemPrompt(updated.persona),
  };
}

async function getVoice({ orgId, id }) {
  const agent = await loadOwnedAgent(id, orgId);
  return { voice_id: agent.voice_id, provider: agent.provider };
}

async function updateVoice({ orgId, id, voiceId }) {
  await loadOwnedAgent(id, orgId);
  validateString(voiceId, "voice_id", VOICE_ID_MAX_LENGTH);
  return agentRepository.updateById({
    id,
    orgId,
    patch: { voice_id: voiceId.trim() },
  });
}

function buildAgentConfiguration(agent) {
  if (!agent) throw ApiError.badRequest("Agent is required");
  return {
    agentId: agent.id,
    provider: agent.provider,
    voiceId: agent.voice_id,
    providerRef: agent.provider_ref,
    systemPrompt: generateSystemPrompt(agent.persona || {}),
  };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  updatePersona,
  getVoice,
  updateVoice,
  buildAgentConfiguration,
};
