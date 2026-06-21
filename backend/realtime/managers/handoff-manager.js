const HANDOFF_REASONS = {
  frustration: /\b(frustrated|angry|useless|annoyed)\b/i,
  highIntent: /\b(buy now|enroll now|speak to sales)\b/i,
  legalFinancial: /\b(legal|contract|refund law|financial advice|investment)\b/i,
  humanRequest: /\b(human|person|agent|representative)\b/i,
};

export class HandoffManager {
  evaluate(userText = "", clarificationFailures = 0) {
    if (clarificationFailures >= 2) {
      return { shouldHandoff: true, type: "live_transfer", reason: "repeated_clarification_failure" };
    }

    for (const [reason, re] of Object.entries(HANDOFF_REASONS)) {
      if (re.test(userText)) {
        const type = reason === "highIntent" ? "crm_escalation" : "live_transfer";
        return { shouldHandoff: true, type, reason };
      }
    }

    return { shouldHandoff: false, type: "none", reason: "" };
  }
}

export const handoffManager = new HandoffManager();
