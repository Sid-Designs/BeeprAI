import LeadOutcome from "../models/leadOutcome.model.js";

const cleanText = (value, max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const upsertLeadOutcome = async ({
  tenantId,
  agentId,
  sessionId,
  roomName,
  objective,
  stage,
  leadStatus,
  collectedData,
  summary,
  endReason,
  isClosed,
  turnCount,
  lastUserMessage,
  lastAssistantMessage,
  callbackRequested,
  callbackSchedule,
  telemetry,
  learning,
  intentInsight,
}) => {
  if (!tenantId || !agentId || !sessionId) return null;

  const update = {
    tenantId,
    agentId,
    roomName: cleanText(roomName, 120),
    objective: cleanText(objective, 80) || "custom",
    stage: cleanText(stage, 80) || "opening",
    leadStatus: cleanText(leadStatus, 80) || "new",
    collectedData: collectedData || {},
    summary: cleanText(summary, 500),
    endReason: cleanText(endReason, 200),
    isClosed: Boolean(isClosed),
    turnCount: Number.isFinite(turnCount) ? turnCount : 0,
    lastUserMessage: cleanText(lastUserMessage, 500),
    lastAssistantMessage: cleanText(lastAssistantMessage, 500),
    callbackRequested: Boolean(callbackRequested),
    callbackSchedule: callbackSchedule || null,
    telemetry: telemetry && typeof telemetry === "object" ? telemetry : {},
    learning: learning && typeof learning === "object" ? learning : {},
    intentInsight: intentInsight && typeof intentInsight === "object" ? intentInsight : {},
  };

  return LeadOutcome.findOneAndUpdate(
    { sessionId },
    { $set: update, $setOnInsert: { sessionId } },
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  );
};

export const closeLeadOutcome = async ({ sessionId, endReason = "" } = {}) => {
  if (!sessionId) return null;

  return LeadOutcome.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        isClosed: true,
        endReason: cleanText(endReason, 200),
      },
    },
    { returnDocument: "after" },
  );
};

export const getLeadOutcomeBySessionId = async (sessionId) => {
  if (!sessionId) return null;
  return LeadOutcome.findOne({ sessionId }).lean();
};

export const getLeadOutcomeByRoomName = async (roomName) => {
  if (!roomName) return null;
  return LeadOutcome.findOne({ roomName }).lean();
};

/** Tenant-safe payload for in-progress call polling (Phase C3). */
export const formatLiveCallStatus = (record) => {
  if (!record) return null;

  return {
    sessionId: record.sessionId,
    tenantId: record.tenantId,
    agentId: record.agentId,
    roomName: cleanText(record.roomName, 120),
    stage: cleanText(record.stage, 80) || "opening",
    leadStatus: cleanText(record.leadStatus, 80) || "new",
    turnCount: Number.isFinite(record.turnCount) ? record.turnCount : 0,
    lastUserMessage: cleanText(record.lastUserMessage, 500),
    lastAssistantMessage: cleanText(record.lastAssistantMessage, 500),
    collectedData:
      record.collectedData && typeof record.collectedData === "object"
        ? record.collectedData
        : {},
    isClosed: Boolean(record.isClosed),
    objective: cleanText(record.objective, 80) || "custom",
    endReason: cleanText(record.endReason, 200),
    intentInsight:
      record.intentInsight && typeof record.intentInsight === "object"
        ? record.intentInsight
        : {},
    updatedAt: record.updatedAt || null,
  };
};
