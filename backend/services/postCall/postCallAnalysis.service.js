import CallAnalysis from "../../models/callAnalysis.model.js";
import LeadOutcome from "../../models/leadOutcome.model.js";
import { closeLeadOutcome } from "../leadOutcome.service.js";
import {
  analyzeCallWithLLM,
  buildRuleBasedAnalysis,
} from "./postCallLLM.service.js";
import {
  buildStructuredTranscript,
  formatTranscriptForLLM,
  mergeTranscriptSources,
} from "./transcriptAggregator.service.js";
import {
  getSessionCallState,
  getSessionMessages,
  ensureSessionHydrated,
} from "../memory.service.js";

const ENABLE_POST_CALL_ANALYSIS =
  String(process.env.ENABLE_POST_CALL_ANALYSIS || "true").toLowerCase() === "true";

const inFlight = new Set();

const cleanText = (value = "", max = 500) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const resolveSessionId = (payload = {}) =>
  cleanText(payload.sessionId, 120) || cleanText(payload.callId, 120);

const resolveCallId = (payload = {}) =>
  cleanText(payload.callId, 120) || cleanText(payload.sessionId, 120) || cleanText(payload.roomName, 120);

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildAnalysisRecord = ({
  payload,
  transcript,
  analysis,
  analysisSource,
  analysisStatus,
}) => {
  const startTime = toDateOrNull(payload.startTime) || transcript[0]?.timestamp || new Date();
  const endTime = toDateOrNull(payload.endTime) || transcript[transcript.length - 1]?.timestamp || new Date();
  const durationMs = Math.max(0, endTime.getTime() - startTime.getTime());

  return {
    callId: resolveCallId(payload),
    sessionId: resolveSessionId(payload),
    roomName: cleanText(payload.roomName, 120),
    tenantId: payload.tenantId,
    agentId: payload.agentId,
    phoneNumber: cleanText(payload.phoneNumber, 40),
    startTime,
    endTime,
    duration: durationMs,
    summary: cleanText(analysis.summary, 1200),
    primaryIntent: cleanText(analysis.primaryIntent, 80),
    secondaryIntents: Array.isArray(analysis.secondaryIntents) ? analysis.secondaryIntents : [],
    outcome: cleanText(analysis.outcome, 80),
    leadScore: Number(analysis.leadScore || 0),
    sentiment: cleanText(analysis.sentiment, 20),
    objections: Array.isArray(analysis.objections) ? analysis.objections : [],
    collectedInformation:
      analysis.collectedInformation && typeof analysis.collectedInformation === "object"
        ? analysis.collectedInformation
        : {},
    appointmentBooked: Boolean(analysis.appointmentBooked),
    appointmentDate: cleanText(analysis.appointmentDate, 80),
    appointmentTime: cleanText(analysis.appointmentTime, 40),
    nextAction: cleanText(analysis.nextAction, 240),
    transcript,
    analysisStatus,
    analysisSource,
    endReason: cleanText(payload.endReason, 200),
    triggerSource: cleanText(payload.triggerSource, 80),
    metadata: {
      turnCount: Number(payload.callState?.turnCount || 0),
      objective: cleanText(payload.objective, 80),
      leadStatus: cleanText(payload.callState?.leadStatus, 40),
      bookingStatus: cleanText(payload.callState?.bookingStatus, 40),
      kbGateTriggered: Boolean(
        payload.analyticsSnapshot?.kbGateTriggered ||
          payload.callState?.telemetry?.kbGateTriggered,
      ),
      analytics: {
        ...(payload.analyticsSnapshot && typeof payload.analyticsSnapshot === "object"
          ? payload.analyticsSnapshot
          : {}),
        ...(payload.callState?.telemetry && typeof payload.callState.telemetry === "object"
          ? payload.callState.telemetry
          : {}),
      },
      intentInsight: payload.callState?.intentInsight || payload.intentInsight || {},
      appointmentId: cleanText(payload.callState?.collectedData?.appointmentId, 80),
    },
  };
};

const loadLeadOutcome = async (sessionId) => {
  if (!sessionId) return null;
  try {
    return await LeadOutcome.findOne({ sessionId }).lean();
  } catch {
    return null;
  }
};

const enrichPayloadFromSession = async (payload = {}) => {
  const sessionId = resolveSessionId(payload);
  await ensureSessionHydrated(sessionId);
  const sessionMessages = getSessionMessages(sessionId);
  const sessionCallState = getSessionCallState(sessionId);
  const mergedMessages = mergeTranscriptSources(sessionMessages, payload.conversationHistory);

  return {
    ...payload,
    sessionId,
    callId: resolveCallId(payload),
    conversationHistory: mergedMessages,
    callState: {
      ...(sessionCallState || {}),
      ...(payload.callState || {}),
      collectedData: {
        ...(sessionCallState?.collectedData || {}),
        ...(payload.callState?.collectedData || {}),
      },
    },
  };
};

const enrichPayloadFromLeadOutcome = (payload, leadOutcome) => {
  if (!leadOutcome) return payload;

  return {
    ...payload,
    objective: payload.objective || leadOutcome.objective,
    analyticsSnapshot: {
      ...(leadOutcome.telemetry && typeof leadOutcome.telemetry === "object"
        ? leadOutcome.telemetry
        : {}),
      ...(payload.analyticsSnapshot && typeof payload.analyticsSnapshot === "object"
        ? payload.analyticsSnapshot
        : {}),
    },
    callState: {
      ...(payload.callState || {}),
      stage: payload.callState?.stage || leadOutcome.stage,
      leadStatus: payload.callState?.leadStatus || leadOutcome.leadStatus,
      turnCount: payload.callState?.turnCount || leadOutcome.turnCount,
      collectedData: {
        ...(leadOutcome.collectedData || {}),
        ...(payload.callState?.collectedData || {}),
      },
      intentInsight: {
        ...(leadOutcome.intentInsight || {}),
        ...(payload.callState?.intentInsight || {}),
      },
      userIntent: payload.callState?.userIntent || {
        intent: leadOutcome.intentInsight?.primaryIntent,
        confidence: leadOutcome.intentInsight?.confidence,
      },
    },
    endReason: payload.endReason || leadOutcome.endReason || "",
  };
};

export const runPostCallAnalysis = async (rawPayload = {}) => {
  if (!ENABLE_POST_CALL_ANALYSIS) {
    return { skipped: true, reason: "disabled" };
  }

  const sessionId = resolveSessionId(rawPayload);
  if (!sessionId || !rawPayload.tenantId || !rawPayload.agentId) {
    return { skipped: true, reason: "missing_identifiers" };
  }

  if (inFlight.has(sessionId)) {
    return { skipped: true, reason: "already_running", sessionId };
  }

  const existing = await CallAnalysis.findOne({ sessionId }).lean();
  if (existing?.analysisStatus === "completed") {
    return { skipped: true, reason: "already_completed", sessionId, recordId: existing._id };
  }

  inFlight.add(sessionId);

  try {
    await closeLeadOutcome({
      sessionId,
      endReason: rawPayload.endReason,
    });

    await CallAnalysis.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          callId: resolveCallId(rawPayload),
          sessionId,
          roomName: cleanText(rawPayload.roomName, 120),
          tenantId: rawPayload.tenantId,
          agentId: rawPayload.agentId,
          analysisStatus: "processing",
          triggerSource: cleanText(rawPayload.triggerSource, 80),
          endReason: cleanText(rawPayload.endReason, 200),
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    let payload = await enrichPayloadFromSession(rawPayload);
    const leadOutcome = await loadLeadOutcome(sessionId);
    payload = enrichPayloadFromLeadOutcome(payload, leadOutcome);

    const startTime =
      toDateOrNull(payload.startTime) ||
      toDateOrNull(payload.callState?.callStartedAt) ||
      toDateOrNull(leadOutcome?.createdAt);
    const endTime = toDateOrNull(payload.endTime) || new Date();
    const durationSeconds =
      Number(payload.durationSeconds) ||
      Math.max(0, Math.round((endTime.getTime() - (startTime?.getTime() || endTime.getTime())) / 1000));

    const transcript = buildStructuredTranscript({
      messages: payload.conversationHistory,
      startTime,
      endTime,
    });

    const llmContext = {
      transcriptText: formatTranscriptForLLM(transcript),
      callState: payload.callState,
      endReason: payload.endReason,
      objective: payload.objective,
      phoneNumber: payload.phoneNumber,
      durationSeconds,
    };

    let analysis = null;
    let analysisSource = "rules";

    const llmResult = await analyzeCallWithLLM(llmContext);
    if (llmResult.success) {
      analysis = llmResult.analysis;
      analysisSource = "llm";
    } else {
      const ruleAnalysis = buildRuleBasedAnalysis(llmContext);
      if (llmResult.error && transcript.length > 0) {
        analysis = ruleAnalysis;
        analysisSource = "hybrid";
      } else {
        analysis = ruleAnalysis;
        analysisSource = "rules";
      }
    }

    const record = buildAnalysisRecord({
      payload: {
        ...payload,
        startTime,
        endTime,
      },
      transcript,
      analysis,
      analysisSource,
      analysisStatus: "completed",
    });

    const saved = await CallAnalysis.findOneAndUpdate(
      { sessionId },
      { $set: record },
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    return {
      success: true,
      sessionId,
      recordId: saved?._id,
      outcome: saved?.outcome,
      leadScore: saved?.leadScore,
      analysisSource,
    };
  } catch (error) {
    await CallAnalysis.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          analysisStatus: "failed",
          metadata: {
            error: cleanText(error?.message, 300),
            triggerSource: cleanText(rawPayload.triggerSource, 80),
          },
        },
      },
      { upsert: true },
    );

    console.error("[post-call] analysis failed:", error?.message || error);
    return {
      success: false,
      sessionId,
      error: error?.message || "analysis_failed",
    };
  } finally {
    inFlight.delete(sessionId);
  }
};

export const runPostCallAnalysisByRoom = async ({
  roomName,
  tenantId,
  agentId,
  endReason = "room_ended",
  triggerSource = "sip_webhook",
  phoneNumber = "",
} = {}) => {
  if (!roomName || !tenantId || !agentId) {
    return { skipped: true, reason: "missing_identifiers" };
  }

  const leadOutcome = await LeadOutcome.findOne({ roomName })
    .sort({ updatedAt: -1 })
    .lean();

  if (!leadOutcome?.sessionId) {
    return { skipped: true, reason: "no_session_for_room", roomName };
  }

  return runPostCallAnalysis({
    sessionId: leadOutcome.sessionId,
    callId: leadOutcome.sessionId,
    roomName,
    tenantId: tenantId || leadOutcome.tenantId,
    agentId: agentId || leadOutcome.agentId,
    phoneNumber,
    endReason,
    triggerSource,
    objective: leadOutcome.objective,
    callState: {
      stage: leadOutcome.stage,
      leadStatus: leadOutcome.leadStatus,
      turnCount: leadOutcome.turnCount,
      collectedData: leadOutcome.collectedData || {},
      intentInsight: leadOutcome.intentInsight || {},
    },
  });
};

export const getCallAnalysisBySessionId = async (sessionId) => {
  if (!sessionId) return null;
  return CallAnalysis.findOne({ sessionId }).lean();
};

export const listCallAnalyses = async ({ tenantId, agentId, limit = 20, skip = 0 } = {}) => {
  const query = {};
  if (tenantId) query.tenantId = tenantId;
  if (agentId) query.agentId = agentId;

  return CallAnalysis.find(query)
    .sort({ createdAt: -1 })
    .skip(Math.max(0, skip))
    .limit(Math.min(Math.max(limit, 1), 100))
    .lean();
};

export const listKbGapSignalAnalyses = async ({
  tenantId,
  agentId,
  windowHours = 24,
  limit = 500,
} = {}) => {
  const hours = Math.min(Math.max(Number(windowHours) || 24, 1), 24 * 30);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query = {
    createdAt: { $gte: since },
    analysisStatus: "completed",
    $or: [
      { outcome: { $in: ["abandoned", "unanswered"] } },
      { "metadata.kbGateTriggered": true },
      { "metadata.analytics.kbGateTriggered": true },
    ],
  };
  if (tenantId) query.tenantId = tenantId;
  if (agentId) query.agentId = agentId;

  return CallAnalysis.find(query)
    .select(
      "sessionId tenantId agentId outcome summary primaryIntent transcript metadata createdAt",
    )
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 500, 1), 1000))
    .lean();
};
