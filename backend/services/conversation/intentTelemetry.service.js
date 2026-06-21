const cleanText = (value = "", max = 120) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const buildIntentTelemetry = ({
  state = {},
  turnDirective = null,
  extra = {},
} = {}) => {
  const userIntent = state.userIntent && typeof state.userIntent === "object" ? state.userIntent : {};
  return {
    userIntent: userIntent.intent || "unknown",
    intentConfidence: Number(userIntent.confidence || 0),
    intentStatus: cleanText(state.intentStatus, 40) || "pending",
    intentResolvedAtTurn: Number(state.intentResolvedAtTurn || 0) || null,
    intentResolutionMs: Number(state.intentResolutionMs || 0) || null,
    bookingReadiness: cleanText(state.bookingReadiness, 40) || "not_asked",
    returnStage: cleanText(state.returnStage, 60) || "",
    directiveAction: cleanText(turnDirective?.action, 60) || "",
    stage: cleanText(state.stage, 60) || "",
    ...(extra && typeof extra === "object" ? extra : {}),
  };
};

export const buildIntentInsight = ({ state = {}, turnDirective = null } = {}) => {
  const telemetry = buildIntentTelemetry({ state, turnDirective });
  return {
    primaryIntent: telemetry.userIntent,
    confidence: telemetry.intentConfidence,
    intentStatus: telemetry.intentStatus,
    intentResolvedAtTurn: telemetry.intentResolvedAtTurn,
    intentResolutionMs: telemetry.intentResolutionMs,
    bookingReadiness: telemetry.bookingReadiness,
    latestStage: telemetry.stage,
    latestDirective: telemetry.directiveAction,
  };
};
