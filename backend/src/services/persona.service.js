function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function formatBullets(items) {
  return items
    .map((item) => `- ${typeof item === "string" ? item.trim() : JSON.stringify(item)}`)
    .join("\n");
}

function buildIdentityBlock(persona) {
  if (persona.identity && typeof persona.identity === "string") return persona.identity;

  const name = persona.agent_name || persona.name || "the assistant";
  const role = persona.role || "a voice AI agent";
  const company = persona.business_name || persona.company;

  let block = `You are ${name}, ${role}`;
  if (company) block += ` for ${company}`;
  block += ".";

  if (persona.direction === "outbound") {
    block += " You are making an outbound call on behalf of the business.";
  } else if (persona.direction === "inbound") {
    block += " You are answering an inbound call from a customer.";
  }

  return block;
}

function buildPersonalityBlock(persona) {
  const parts = [];
  const tone = persona.tone || persona.style;
  if (tone) {
    parts.push(typeof tone === "string" ? tone : `Tone: ${JSON.stringify(tone)}`);
  }
  if (persona.energy) parts.push(`Energy: ${persona.energy}`);
  if (persona.pace) parts.push(`Pace: ${persona.pace}`);
  if (persona.language_style) parts.push(`Language style: ${persona.language_style}`);

  if (parts.length === 0) {
    parts.push("Professional, clear, and conversational. Speak naturally as a human would on the phone.");
  }

  parts.push("Keep responses concise — one to two sentences at a time.");
  parts.push("Never use markdown, emojis, or formatting that sounds unnatural when spoken.");

  return parts.join("\n");
}

function buildContextBlock(persona) {
  const parts = [];

  if (persona.context) {
    parts.push(typeof persona.context === "string" ? persona.context : JSON.stringify(persona.context));
  }

  if (persona.business_name) parts.push(`Business: ${persona.business_name}`);
  if (persona.vertical) parts.push(`Industry: ${persona.vertical}`);
  if (persona.timezone) parts.push(`Timezone: ${persona.timezone}`);

  if (persona.available_data) {
    const dataItems = asArray(persona.available_data);
    if (dataItems.length) {
      parts.push("Available data for this call:");
      parts.push(formatBullets(dataItems));
    }
  }

  return parts.length > 0 ? parts.join("\n") : null;
}

function buildGoalsBlock(persona) {
  const goals = persona.goals || persona.objective || persona.objectives;
  const goalList = asArray(goals);
  if (goalList.length === 0) return null;
  return formatBullets(goalList);
}

function buildConversationFlowBlock(persona) {
  const flow = persona.conversation_flow || persona.flow || persona.steps;
  if (!flow) return null;

  if (typeof flow === "string") return flow;
  const flowList = asArray(flow);
  if (flowList.length === 0) return null;

  return flowList.map((step, i) => `${i + 1}. ${step}`).join("\n");
}

function buildGuardrailsBlock(persona) {
  const guardrails = asArray(persona.guardrails);
  const base = [
    "If the recipient asks to be removed from the call list, immediately comply and end the call politely.",
    "Never provide medical, legal, or financial advice.",
    "If you cannot help, offer to transfer to a human.",
  ];

  const combined = [...guardrails];
  for (const rule of base) {
    if (!combined.some((g) => g.toLowerCase().includes(rule.slice(0, 30).toLowerCase()))) {
      combined.push(rule);
    }
  }

  return formatBullets(combined);
}

function buildOpeningMessageBlock(persona) {
  const msg = persona.opening_message || persona.first_message;
  if (!msg) return null;
  return `Begin the conversation with: "${msg.trim()}"`;
}

class PersonaService {
  generateSystemPrompt(persona = {}) {
    if (persona.system_prompt && typeof persona.system_prompt === "string" && persona.system_prompt.length > 100) {
      return persona.system_prompt;
    }

    const sections = [];

    sections.push(`# IDENTITY\n${buildIdentityBlock(persona)}`);
    sections.push(`# PERSONALITY & SPEECH STYLE\n${buildPersonalityBlock(persona)}`);

    const context = buildContextBlock(persona);
    if (context) sections.push(`# CONTEXT\n${context}`);

    const goals = buildGoalsBlock(persona);
    if (goals) sections.push(`# GOALS\n${goals}`);

    const flow = buildConversationFlowBlock(persona);
    if (flow) sections.push(`# CONVERSATION FLOW\n${flow}`);

    sections.push(`# GUARDRAILS\n${buildGuardrailsBlock(persona)}`);

    const opening = buildOpeningMessageBlock(persona);
    if (opening) sections.push(`# OPENING MESSAGE\n${opening}`);

    return sections.join("\n\n");
  }

  extractFirstMessage(persona = {}) {
    return persona.first_message || persona.opening_message || "Hello, how can I help you today?";
  }
}

module.exports = new PersonaService();
