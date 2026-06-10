class PersonaService {
  /**
   * Generates a comprehensive system prompt string from a structured persona object.
   * @param {Object} persona
   * @param {string} persona.identity
   * @param {string} persona.tone
   * @param {string} persona.goals
   * @param {string} persona.guardrails
   * @param {string} persona.opening_message
   * @returns {string} Compiled system prompt
   */
  generateSystemPrompt(persona = {}) {
    const {
      tone = "Professional and concise.",
      guardrails = "Do not provide harmful or dangerous information.",
      opening_message = "Hello, how can I help you today?",
      business_name = ""
    } = persona;

    // Use persona.context, persona.objective, or persona.goals as the main goals/context
    const goals = persona.context || persona.objective || persona.goals || "Assist the user with their queries.";

    // Use persona.identity, or build one using business_name
    let identity = persona.identity;
    if (!identity) {
      if (business_name) {
        identity = `You are a helpful voice AI assistant representing ${business_name}.`;
      } else {
        identity = "You are a helpful AI assistant.";
      }
    }

    return `
You are a voice AI assistant. You must adhere to the following persona strictly.

# IDENTITY
${identity}

# TONE & STYLE
${tone}

# GOALS
${goals}

# GUARDRAILS
${guardrails}

# OPENING MESSAGE
When the user connects, you should greet them with:
"${opening_message}"

# BEHAVIORAL INSTRUCTIONS
1. Always maintain the specified tone.
2. Keep your responses conversational, suitable for a voice call.
3. Do not use complex markdown, emojis, or formatting that sounds unnatural when spoken.
`.trim();
  }
}

module.exports = new PersonaService();
