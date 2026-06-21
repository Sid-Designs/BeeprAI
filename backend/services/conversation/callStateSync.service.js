import { buildCallStatePayload, normalizeStage } from "./conversationStage.service.js";

const TEMPLATE_ACTIONS = new Set([
  "opening_greeting",
  "intent_discovery_reply",
  "clarify_intent",
  "intent_menu",
  "collect_slot",
  "probe_booking_readiness",
  "booking_declined",
  "offer_close",
  "graceful_close",
  "appointment_booking",
  "complete_booking",
  "answer_then_steer",
  "callback",
  "handle_objection",
  "confirm_appointment",
  "appointment_not_found",
  "close",
]);

export const TRUSTED_ANSWER_SOURCES = new Set([
  "intent_director",
  "memory",
  "template",
  "llm_kb",
  "kb+llm",
]);

export const isTemplateDirective = (action = "") => TEMPLATE_ACTIONS.has(String(action || "").trim());

export const shouldTrustApiAnswer = (apiResult = {}) => {
  if (apiResult?.fromMemory === true) return true;

  const answerSource = String(apiResult?.answerSource || "").trim().toLowerCase();
  if (answerSource && TRUSTED_ANSWER_SOURCES.has(answerSource)) return true;

  const action = String(apiResult?.directiveAction || "").trim();
  if (isTemplateDirective(action)) return true;

  if (answerSource && answerSource !== "llm") return true;

  return false;
};

export const shouldApplyWorkerAnswerRecovery = (apiResult = {}) => !shouldTrustApiAnswer(apiResult);

export const syncWorkerStateFromApi = (workerState = {}, apiResult = {}) => {
  if (!workerState || !apiResult) return workerState;

  const collectedData =
    apiResult.collectedData && typeof apiResult.collectedData === "object"
      ? apiResult.collectedData
      : workerState.conversationState?.collectedData || {};

  workerState.conversationState = {
    ...(workerState.conversationState || {}),
    stage: normalizeStage(apiResult.stage || workerState.conversationState?.stage),
    leadStatus: apiResult.leadStatus || workerState.conversationState?.leadStatus || "new",
    collectedData,
    userIntent: apiResult.userIntent || workerState.userIntent || workerState.conversationState?.userIntent,
    bookingReadiness: apiResult.bookingReadiness || workerState.bookingReadiness,
    intentStatus: apiResult.intentStatus || workerState.intentStatus,
    objectiveAchieved: Boolean(apiResult.objectiveAchieved ?? workerState.objectiveAchieved),
  };

  if (apiResult.stage) {
    workerState.callStage = normalizeStage(apiResult.stage);
  }
  if (apiResult.bookingReadiness) {
    workerState.bookingReadiness = apiResult.bookingReadiness;
  }
  if (apiResult.returnStage) {
    workerState.returnStage = apiResult.returnStage;
  }
  if (apiResult.intentStatus) {
    workerState.intentStatus = apiResult.intentStatus;
  }
  if (apiResult.userIntent) {
    workerState.userIntent = apiResult.userIntent;
  }
  if (apiResult.directiveAction) {
    workerState.lastDirectiveAction = apiResult.directiveAction;
  }
  if (typeof apiResult.interruptionPending !== "undefined") {
    workerState.conversationState = {
      ...(workerState.conversationState || {}),
      interruptedUtterance: apiResult.interruptedUtterance || "",
      activeTopic: apiResult.activeTopic || "",
      interruptionPending: Boolean(apiResult.interruptionPending),
    };
  }
  if (typeof apiResult.objectiveAchieved !== "undefined") {
    workerState.objectiveAchieved = Boolean(apiResult.objectiveAchieved);
  }

  return workerState;
};

export { buildCallStatePayload };
