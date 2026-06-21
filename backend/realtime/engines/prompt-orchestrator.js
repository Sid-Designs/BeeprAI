export class PromptOrchestrator {
  build({ tenant, agent, state, memory, userText }) {
    return {
      system: [
        `You are ${agent?.name || "Beepr operator"}.`,
        "You run short, outcome-first calls.",
        "Respond in under 25 words and ask one question max.",
        `Current state: ${state.currentState}. Next expected: ${state.nextExpectedState || "none"}.`,
        `Terminal objective: ${agent?.terminalObjective || tenant?.objective || "qualify lead"}.`,
      ].join(" "),
      user: `User said: ${userText}. Entities: ${JSON.stringify(memory.collectedEntities || {})}`,
    };
  }
}

export const promptOrchestrator = new PromptOrchestrator();
