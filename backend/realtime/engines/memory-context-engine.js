const REQUIRED_MEMORY_KEYS = [
  "userIntent",
  "courseInterest",
  "language",
  "eligibility",
  "leadQuality",
  "userMood",
  "callbackRequested",
  "transferRequired",
  "conversationStage",
  "lastQuestion",
  "collectedEntities",
];

const BLANK_MEMORY = Object.freeze({
  userIntent: "",
  courseInterest: "",
  language: "en",
  eligibility: "unknown",
  leadQuality: "unknown",
  userMood: "neutral",
  callbackRequested: false,
  transferRequired: false,
  conversationStage: "INIT",
  lastQuestion: "",
  collectedEntities: {},
});

export class MemoryContextEngine {
  create(initial = {}) {
    return this.merge(BLANK_MEMORY, initial);
  }

  merge(base = {}, patch = {}) {
    const merged = {
      ...BLANK_MEMORY,
      ...base,
      ...patch,
      collectedEntities: {
        ...(base.collectedEntities || {}),
        ...(patch.collectedEntities || {}),
      },
    };

    for (const key of REQUIRED_MEMORY_KEYS) {
      if (!(key in merged)) merged[key] = BLANK_MEMORY[key];
    }

    return merged;
  }

  unresolved(memory = {}) {
    const data = memory.collectedEntities || {};
    const required = ["name", "intent", "timeline"];
    return required.filter((field) => !String(data[field] || "").trim());
  }
}

export const memoryContextEngine = new MemoryContextEngine();
