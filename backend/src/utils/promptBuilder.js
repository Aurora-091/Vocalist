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

/**
 * Convert a structured persona JSON document into a final LLM system prompt.
 *
 * Persona shape (all keys optional):
 * {
 *   identity:   { name, role, company, ... },
 *   tone:       { style, energy, ... },
 *   goals:      [string],
 *   guardrails: [string],
 *   opening_message: string,
 *   ...arbitrary keys are appended as `Additional Context`.
 * }
 */
function generateSystemPrompt(persona) {
  const safePersona = persona && typeof persona === "object" ? persona : {};

  const {
    identity = {},
    tone = {},
    goals,
    guardrails,
    opening_message: openingMessage,
    ...rest
  } = safePersona;

  const sections = [];

  const agentName = identity.name || "the assistant";
  const agentRole = identity.role || "an AI voice agent";
  const company = identity.company ? ` for ${identity.company}` : "";
  sections.push(
    `You are ${agentName}, ${agentRole}${company}. Speak naturally in the first person.`
  );

  const toneParts = [];
  if (tone.style) toneParts.push(`tone is ${tone.style}`);
  if (tone.energy) toneParts.push(`energy is ${tone.energy}`);
  if (tone.pace) toneParts.push(`pace is ${tone.pace}`);
  if (tone.language) toneParts.push(`language is ${tone.language}`);
  if (toneParts.length) {
    sections.push(`# Tone\nYour ${toneParts.join(", your ")}.`);
  }

  const goalList = asArray(goals);
  if (goalList.length) {
    sections.push(`# Primary Goals\n${formatBullets(goalList)}`);
  }

  const guardrailList = asArray(guardrails);
  if (guardrailList.length) {
    sections.push(
      `# Guardrails (must follow)\n${formatBullets(guardrailList)}`
    );
  }

  const extraKeys = Object.keys(rest).filter((k) => rest[k] !== undefined && rest[k] !== null);
  if (extraKeys.length) {
    const lines = extraKeys.map((key) => {
      const value = rest[key];
      const label = key.replace(/_/g, " ");
      if (Array.isArray(value)) return `${label}:\n${formatBullets(value)}`;
      if (typeof value === "object") return `${label}: ${JSON.stringify(value)}`;
      return `${label}: ${value}`;
    });
    sections.push(`# Additional Context\n${lines.join("\n")}`);
  }

  if (openingMessage && typeof openingMessage === "string") {
    sections.push(
      `# Opening Message\nBegin every new conversation with: "${openingMessage.trim()}"`
    );
  }

  sections.push(
    "# General Behavior\n- Keep responses concise and conversational.\n- Confirm understanding before taking actions.\n- If a request violates a guardrail, politely decline and offer to escalate."
  );

  return sections.join("\n\n");
}

module.exports = { generateSystemPrompt };
