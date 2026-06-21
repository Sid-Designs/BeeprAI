const BANNED_PHRASES = [
  "let us take the next step",
  "how may i assist you",
  "here is what we can do now",
  "could you elaborate",
  "thank you for your patience",
];

const clampWords = (text, maxWords = 25) => {
  const parts = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return parts.slice(0, maxWords).join(" ");
};

export class DialoguePolicyEngine {
  enforce(rawText, state, memory) {
    let text = String(rawText || "").replace(/\s+/g, " ").trim();

    for (const phrase of BANNED_PHRASES) {
      const re = new RegExp(phrase, "ig");
      text = text.replace(re, "");
    }

    const unresolved = memory?.unresolvedFields || [];
    if (unresolved.length > 0 && !text.includes("?")) {
      const field = unresolved[0];
      text = `${text.replace(/[.]+$/g, "")}. ${this.nextQuestionFor(field)}`.trim();
    }

    return clampWords(text, 25);
  }

  nextQuestionFor(field) {
    if (field === "name") return "What should I call you?";
    if (field === "intent") return "What do you need help with today?";
    if (field === "timeline") return "When do you want to start?";
    return "What is the key detail I should confirm?";
  }
}

export const dialoguePolicyEngine = new DialoguePolicyEngine();
