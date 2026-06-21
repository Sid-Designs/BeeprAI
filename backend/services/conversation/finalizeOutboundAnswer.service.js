import { validateResponse } from "./responseValidator.service.js";
import { validateResponseCompliance } from "../compliance/responseCompliance.service.js";
import { shapeVoiceFriendlyText } from "../realtime/voiceRealism.service.js";

const positiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_MAX_CHARS = positiveInt(process.env.CALL_MAX_ANSWER_CHARS, 220);

const trimAtWordBoundary = (text = "", maxChars = DEFAULT_MAX_CHARS) => {
  const value = String(text || "").trim();
  if (value.length <= maxChars) return value;
  const clipped = value.slice(0, maxChars + 1);
  const boundary = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?"),
    clipped.lastIndexOf(";"),
    clipped.lastIndexOf(","),
    clipped.lastIndexOf(" "),
  );
  const safe = (boundary > 80 ? clipped.slice(0, boundary) : value.slice(0, maxChars))
    .replace(/[,\s;:–—-]+$/g, "")
    .trim();
  return safe ? `${safe}...` : "";
};

export const trimAnswer = (text, maxChars = DEFAULT_MAX_CHARS) => {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const shortText = sentences.slice(0, 2).join(" ").trim();
  if (shortText.length <= maxChars) return shortText;

  return trimAtWordBoundary(shortText, maxChars);
};

export const removeRepeatedIntro = (text = "", stage = "discovery") => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  if (String(stage || "").toLowerCase() === "opening") return value;
  return (
    value
      .replace(/^(hello|hi)[!,. ]*(this is|i am)[^.!?]{0,90}[.!?]\s*/i, "")
      .trim() || value
  );
};

export const ensureWarmClosing = (text = "") => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "Thanks for your time. Goodbye, take care.";
  if (/\b(goodbye|bye|see you|take care)\b/i.test(value)) return value;
  return `${value} Goodbye, take care.`;
};

export const maxCharsForProfile = (profile = {}) => {
  const words = Number(profile?.wordBudget || 30);
  return Math.max(180, Math.min(360, words * 9));
};

/**
 * Shared outbound pipeline: trim, validate quality, compliance, optional voice shaping.
 */
export const finalizeOutboundAnswer = ({
  answer = "",
  query = "",
  knowledge = "",
  stage = "discovery",
  isOpeningTurn = false,
  previousAiMessage = "",
  responseStyleProfile = {},
  enableCompliance = true,
  enableVoiceRealism = false,
  maxChars,
  applySafeAnswerOnBlock = true,
  trustedTemplate = false,
} = {}) => {
  const charLimit = Number.isFinite(maxChars)
    ? maxChars
    : trustedTemplate
      ? Math.max(340, maxCharsForProfile(responseStyleProfile))
      : maxCharsForProfile(responseStyleProfile);
  let text = trimAnswer(removeRepeatedIntro(answer, stage), charLimit);

  const validation = validateResponse({
    answer: text,
    query,
    knowledge,
    stage,
    isOpeningTurn,
    previousAiMessage,
    trustedTemplate,
  });
  text = validation.answer || text;

  let compliance = { compliant: true, reason: "", safeAnswer: text };
  if (enableCompliance) {
    compliance = validateResponseCompliance({
      query,
      answer: text,
      knowledge,
    });
    if (!compliance.compliant && applySafeAnswerOnBlock) {
      text = compliance.safeAnswer;
    }
  }

  if (enableVoiceRealism) {
    text = shapeVoiceFriendlyText(text, { style: responseStyleProfile.mode });
  }

  return {
    answer: text,
    validation,
    compliance,
  };
};

export const finalizeOutboundAnswerAsync = async ({
  regenerateAnswer = null,
  enableComplianceRetry = true,
  ...finalizeParams
} = {}) => {
  const firstPass = finalizeOutboundAnswer({
    ...finalizeParams,
    applySafeAnswerOnBlock: false,
  });

  if (firstPass.compliance.compliant) {
    return {
      ...firstPass,
      complianceRetried: false,
      complianceRecovered: false,
    };
  }

  if (enableComplianceRetry && typeof regenerateAnswer === "function") {
    try {
      const regenerated = await regenerateAnswer({
        query: finalizeParams.query,
        knowledge: finalizeParams.knowledge,
        blockedAnswer: firstPass.answer,
        reason: firstPass.compliance.reason,
      });
      if (regenerated) {
        const retryPass = finalizeOutboundAnswer({
          ...finalizeParams,
          answer: regenerated,
          applySafeAnswerOnBlock: true,
        });
        return {
          ...retryPass,
          complianceRetried: true,
          complianceRecovered: retryPass.compliance.compliant,
        };
      }
    } catch {
      // fall through to safeAnswer
    }
  }

  return {
    ...firstPass,
    answer: firstPass.compliance.safeAnswer,
    complianceRetried: Boolean(regenerateAnswer),
    complianceRecovered: false,
  };
};
