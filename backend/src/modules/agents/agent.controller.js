const asyncHandler = require("../../utils/asyncHandler");
const { success, created } = require("../../utils/ApiResponse");
const agentService = require("./agent.service");

function serializeAgent(agent) {
  if (!agent) return agent;
  return {
    id: agent.id,
    name: agent.name,
    vertical: agent.vertical,
    provider: agent.provider,
    voice_id: agent.voice_id,
    persona: agent.persona || {},
    provider_ref: agent.provider_ref,
    inbound_number: agent.inbound_number,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
  };
}

const list = asyncHandler(async (req, res) => {
  const agents = await agentService.list({ orgId: req.user.org_id });
  return success(res, { agents: agents.map(serializeAgent) });
});

const get = asyncHandler(async (req, res) => {
  const agent = await agentService.getById({
    orgId: req.user.org_id,
    id: req.params.id,
  });
  return success(res, serializeAgent(agent));
});

const create = asyncHandler(async (req, res) => {
  const agent = await agentService.create({
    orgId: req.user.org_id,
    payload: req.body,
  });
  return created(res, serializeAgent(agent));
});

const update = asyncHandler(async (req, res) => {
  const agent = await agentService.update({
    orgId: req.user.org_id,
    id: req.params.id,
    payload: req.body,
  });
  return success(res, serializeAgent(agent));
});

const remove = asyncHandler(async (req, res) => {
  const result = await agentService.remove({
    orgId: req.user.org_id,
    id: req.params.id,
  });
  return success(res, result, 200, "Agent deleted");
});

const updatePersona = asyncHandler(async (req, res) => {
  const result = await agentService.updatePersona({
    orgId: req.user.org_id,
    id: req.params.id,
    persona: req.body && req.body.persona !== undefined ? req.body.persona : req.body,
  });
  return success(res, {
    ...serializeAgent(result),
    system_prompt: result.system_prompt,
  });
});

const getVoice = asyncHandler(async (req, res) => {
  const voice = await agentService.getVoice({
    orgId: req.user.org_id,
    id: req.params.id,
  });
  return success(res, voice);
});

const updateVoice = asyncHandler(async (req, res) => {
  const agent = await agentService.updateVoice({
    orgId: req.user.org_id,
    id: req.params.id,
    voiceId: req.body && req.body.voice_id,
  });
  return success(res, serializeAgent(agent));
});

const getConfiguration = asyncHandler(async (req, res) => {
  const agent = await agentService.getById({
    orgId: req.user.org_id,
    id: req.params.id,
  });
  return success(res, agentService.buildAgentConfiguration(agent));
});

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  updatePersona,
  getVoice,
  updateVoice,
  getConfiguration,
};
