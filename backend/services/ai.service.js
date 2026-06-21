import axios from "axios";

const AI_QUERY_URL = process.env.AI_QUERY_URL || "http://localhost:5000/api/ai/query";

export const queryAI = async ({
  tenantId,
  agentId,
  query,
  sessionId,
  roomName,
  callObjective,
  callConfig,
  eventType,
  conversationHistory,
  conversationState,
  analyticsSnapshot,
  debug = false,
  languageState,
  interruptionContext,
  signal,
}) => {
  const payload = {
    tenantId,
    agentId,
    query: query || "",
  };

  if (sessionId) {
    payload.sessionId = sessionId;
  }

  if (roomName) {
    payload.roomName = roomName;
  }

  if (callObjective) {
    payload.callObjective = callObjective;
  }

  if (callConfig && typeof callConfig === "object") {
    payload.callConfig = callConfig;
  }

  if (eventType) {
    payload.eventType = eventType;
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length) {
    payload.conversationHistory = conversationHistory;
  }

  if (conversationState && typeof conversationState === "object") {
    payload.conversationState = conversationState;
  }

  if (analyticsSnapshot && typeof analyticsSnapshot === "object") {
    payload.analyticsSnapshot = analyticsSnapshot;
  }

  if (debug) {
    payload.debug = true;
  }

  if (languageState && typeof languageState === "object") {
    payload.languageState = languageState;
  }

  if (interruptionContext && typeof interruptionContext === "object") {
    payload.interruptionContext = interruptionContext;
  }

  const response = await axios.post(AI_QUERY_URL, payload, {
    headers: {
      "Content-Type": "application/json",
    },
    signal,
  });

  return response.data;
};

const CALL_ANALYSIS_URL =
  process.env.CALL_ANALYSIS_URL || "http://localhost:5000/api/call-analysis/finalize";

export const finalizeCall = async ({
  sessionId,
  callId,
  roomName,
  tenantId,
  agentId,
  phoneNumber,
  endReason,
  triggerSource,
  startTime,
  endTime,
  durationSeconds,
  objective,
  callObjective,
  conversationHistory,
  callState,
  analyticsSnapshot,
  intentInsight,
  callConfig,
}) => {
  const payload = {
    sessionId,
    callId,
    roomName,
    tenantId,
    agentId,
    phoneNumber,
    endReason,
    triggerSource,
    startTime,
    endTime,
    durationSeconds,
    objective,
    callObjective,
    conversationHistory,
    callState,
    analyticsSnapshot,
    intentInsight,
    callConfig,
  };

  const response = await axios.post(CALL_ANALYSIS_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      ...(process.env.INTERNAL_SERVICE_TOKEN
        ? { "x-internal-token": process.env.INTERNAL_SERVICE_TOKEN }
        : {}),
    },
    timeout: Number.parseInt(process.env.POST_CALL_API_TIMEOUT_MS || "45000", 10),
  });

  return response.data;
};
