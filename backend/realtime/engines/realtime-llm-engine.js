import { generateAIResponse } from "../../services/llm.service.js";

export class RealtimeLLMEngine {
  async reply({ prompt, history, context, policy, callState, conversationState }) {
    const result = await generateAIResponse({
      agentPrompt: prompt.system,
      context,
      query: prompt.user,
      history,
      policy,
      callState,
      conversationState,
      analyticsSnapshot: {},
      languageInstruction: { promptBlock: "", responseLanguage: "en" },
      nextBestAction: { action: "qualify", objection: "none" },
      objectionGuidance: "",
    });

    return String(result?.answer || "").trim();
  }
}

export const realtimeLlmEngine = new RealtimeLLMEngine();
