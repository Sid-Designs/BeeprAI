export class OutcomeManager {
  detectTerminalOutcome(userText = "", state = "") {
    if (/\b(thank you|okay|done|that'?s all|i'?ll check|not interested)\b/i.test(userText)) {
      return { terminate: true, outcome: "completed_or_disengaged", nextState: "CLOSING" };
    }
    if (state === "TERMINATED") {
      return { terminate: true, outcome: "terminated", nextState: "TERMINATED" };
    }
    return { terminate: false, outcome: "in_progress", nextState: state };
  }
}

export const outcomeManager = new OutcomeManager();
