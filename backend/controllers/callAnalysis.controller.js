import {
  getCallAnalysisBySessionId,
  listCallAnalyses,
  runPostCallAnalysis,
} from "../services/postCall/postCallAnalysis.service.js";
import { fetchKbGapClusterReport } from "../services/insights/kbGapClustering.service.js";
import {
  formatLiveCallStatus,
  getLeadOutcomeBySessionId,
} from "../services/leadOutcome.service.js";
import { assertTenantAccess } from "../services/tenantAccess.service.js";
import { getTenantAnalyticsSummary } from "../services/tenantAnalytics.service.js";
import { formatCallInsights } from "../services/insights/callInsightFormatter.service.js";

export const finalizeCallAnalysis = async (req, res) => {
  try {
    const {
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
    } = req.body || {};

    if (!tenantId || !agentId) {
      return res.status(400).json({
        success: false,
        message: "tenantId and agentId are required",
      });
    }

    if (!sessionId && !callId && !roomName) {
      return res.status(400).json({
        success: false,
        message: "sessionId, callId, or roomName is required",
      });
    }

    const result = await runPostCallAnalysis({
      sessionId,
      callId: callId || sessionId || roomName,
      roomName,
      tenantId,
      agentId,
      phoneNumber,
      endReason,
      triggerSource: triggerSource || "api",
      startTime,
      endTime,
      durationSeconds,
      objective: objective || callObjective || callConfig?.objective || "",
      conversationHistory,
      callState: {
        ...(callState || {}),
        intentInsight: intentInsight || callState?.intentInsight || {},
      },
      analyticsSnapshot,
    });

    if (result.skipped) {
      return res.status(200).json({
        success: true,
        skipped: true,
        reason: result.reason,
        sessionId: result.sessionId || sessionId,
        recordId: result.recordId || null,
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || "Post-call analysis failed",
        sessionId: result.sessionId,
      });
    }

    return res.status(200).json({
      success: true,
      sessionId: result.sessionId,
      recordId: result.recordId,
      outcome: result.outcome,
      leadScore: result.leadScore,
      analysisSource: result.analysisSource,
    });
  } catch (error) {
    console.error("[post-call] finalize error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Post-call analysis failed",
    });
  }
};

export const getCallAnalysis = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const record = await getCallAnalysisBySessionId(sessionId);
    if (!record) {
      return res.status(404).json({ success: false, message: "Call analysis not found" });
    }

    await assertTenantAccess(req.user, record.tenantId);

    return res.status(200).json({
      success: true,
      data: {
        ...record,
        insights: formatCallInsights(record),
      },
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch call analysis",
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

export const getLiveCallStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const record = await getLeadOutcomeBySessionId(sessionId);
    if (!record) {
      return res.status(404).json({ success: false, message: "Live call status not found" });
    }

    await assertTenantAccess(req.user, record.tenantId);

    return res.status(200).json({
      success: true,
      data: formatLiveCallStatus(record),
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch live call status",
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

export const getAnalyticsSummary = async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId is required" });
    }

    await assertTenantAccess(req.user, tenantId);
    const summary = await getTenantAnalyticsSummary(tenantId);

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch analytics summary",
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

export const getKbGapClusters = async (req, res) => {
  try {
    const { tenantId, agentId, windowHours } = req.query;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId is required" });
    }

    await assertTenantAccess(req.user, tenantId);

    const report = await fetchKbGapClusterReport({
      tenantId,
      agentId,
      windowHours: Number(windowHours) || 24,
    });

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch KB gap clusters",
      ...(error.code ? { code: error.code } : {}),
    });
  }
};

export const getCallAnalysisList = async (req, res) => {
  try {
    const { tenantId, agentId, limit, skip } = req.query;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "tenantId is required" });
    }

    await assertTenantAccess(req.user, tenantId);

    const records = await listCallAnalyses({
      tenantId,
      agentId,
      limit: Number(limit) || 20,
      skip: Number(skip) || 0,
    });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to list call analyses",
      ...(error.code ? { code: error.code } : {}),
    });
  }
};
