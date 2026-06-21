/**
 * Canonical conversation stages and progress tracking for Beepr voice calls.
 */

export const CONVERSATION_STAGES = Object.freeze([
  "greeting",
  "intent_discovery",
  "qualification",
  "information_collection",
  "query_resolution",
  "booking_readiness",
  "appointment_booking",
  "confirmation",
  "callback",
  "objection_handling",
  "closing",
  "completed",
]);

const STAGE_ORDER = Object.freeze({
  greeting: 0,
  intent_discovery: 1,
  qualification: 2,
  information_collection: 3,
  query_resolution: 3,
  booking_readiness: 4,
  appointment_booking: 5,
  confirmation: 6,
  callback: 4,
  objection_handling: 3,
  closing: 7,
  completed: 8,
});

const cleanText = (value = "", max = 80) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const normalizeStage = (stage = "") => {
  const value = cleanText(stage, 60).toLowerCase();
  if (CONVERSATION_STAGES.includes(value)) return value;
  if (value === "discovery" || value === "opening") return "intent_discovery";
  if (value === "appointment") return "appointment_booking";
  return value || "intent_discovery";
};

export const stageRank = (stage = "") => STAGE_ORDER[normalizeStage(stage)] ?? 1;

export const isTerminalStage = (stage = "") => {
  const value = normalizeStage(stage);
  return value === "closing" || value === "completed";
};

export const updateConversationProgress = ({
  previousState = {},
  nextStage = "",
  collectedData = {},
  userIntent = null,
  directiveAction = "",
} = {}) => {
  const prevStage = normalizeStage(previousState.stage);
  const newStage = normalizeStage(nextStage || previousState.stage);
  const prevTracker = previousState.goalTracker || {};
  const prevStalled = Number(prevTracker.stalledTurns || 0);
  const prevPrompt = cleanText(previousState.lastAssistantPrompt, 220);

  const dataGrew =
    JSON.stringify(previousState.collectedData || {}) !== JSON.stringify(collectedData || {});
  const stageAdvanced = stageRank(newStage) > stageRank(prevStage);
  const intentResolved = previousState.intentStatus !== "resolved" && userIntent?.intent;

  let lastDelta = "neutral";
  if (stageAdvanced || dataGrew) lastDelta = "progress";
  else if (intentResolved) lastDelta = "intent_resolved";
  else if (isTerminalStage(newStage)) lastDelta = "closing";
  else if (directiveAction === "llm_turn") lastDelta = "stalled";
  else lastDelta = "neutral";

  const stalledTurns =
    lastDelta === "stalled" || (lastDelta === "neutral" && prevPrompt && !dataGrew && !stageAdvanced)
      ? prevStalled + 1
      : 0;

  const cumulativeStalled = Math.max(
    stalledTurns,
    lastDelta === "stalled" ? prevStalled + 1 : prevStalled,
  );

  return {
    goalTracker: {
      lastDelta,
      stalledTurns: cumulativeStalled,
      previousStage: prevStage,
      currentStage: newStage,
    },
    shouldOfferClose:
      cumulativeStalled >= 4 &&
      !isTerminalStage(newStage) &&
      !Boolean(collectedData?.appointmentConfirmed),
    shouldEscalateBooking:
      cumulativeStalled >= 2 &&
      !Boolean(collectedData?.appointmentConfirmed) &&
      ["qualification", "query_resolution", "intent_discovery"].includes(newStage),
    shouldAbortStalledCall:
      cumulativeStalled >= 5 &&
      !isTerminalStage(newStage) &&
      !Boolean(collectedData?.appointmentConfirmed) &&
      !Boolean(collectedData?.appointmentRequested),
  };
};

export const buildCallStatePayload = (state = {}) => ({
  stage: normalizeStage(state.stage),
  leadStatus: cleanText(state.leadStatus, 40) || "new",
  intentStatus: cleanText(state.intentStatus, 40) || "pending",
  bookingReadiness: cleanText(state.bookingReadiness, 40) || "not_asked",
  returnStage: state.returnStage ? normalizeStage(state.returnStage) : null,
  turnCount: Number(state.turnCount || 0),
  collectedData: state.collectedData && typeof state.collectedData === "object" ? state.collectedData : {},
  userIntent: state.userIntent || null,
  objectiveAchieved: Boolean(state.objectiveAchieved),
  closeOffered: Boolean(state.closeOffered),
  goalTracker: state.goalTracker || null,
});
