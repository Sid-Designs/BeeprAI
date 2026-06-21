import RealtimeCallMetric from "../../models/realtimeCallMetric.model.js";

const avg = (arr = []) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

export const summarizeRealtimeMetrics = (session = {}) => {
  const lat = session?.metrics?.latencies || {};
  const tokenUsage = session?.metrics?.tokenUsage || {};
  return {
    wsRoundtripAvgMs: avg(lat.wsRoundtripMs || []),
    modelFirstTokenAvgMs: avg(lat.modelFirstTokenMs || []),
    ttsSynthesisAvgMs: avg(lat.ttsSynthesisMs || []),
    totalTurnAvgMs: avg(lat.totalTurnMs || []),
    tokenUsage: {
      input: Number(tokenUsage.input || 0),
      output: Number(tokenUsage.output || 0),
      total: Number(tokenUsage.total || 0),
    },
  };
};

export const persistRealtimeMetrics = async (session = {}) => {
  if (!session?.callId) return null;
  const summary = summarizeRealtimeMetrics(session);

  return RealtimeCallMetric.findOneAndUpdate(
    { callId: session.callId },
    {
      $set: {
        roomId: session.roomId || "",
        tenantId: session.tenantId || null,
        agentId: session.agentId || null,
        callerNumber: session.callerNumber || "",
        provider: "openai_realtime",
        latencies: {
          wsRoundtripAvgMs: summary.wsRoundtripAvgMs,
          modelFirstTokenAvgMs: summary.modelFirstTokenAvgMs,
          ttsSynthesisAvgMs: summary.ttsSynthesisAvgMs,
          totalTurnAvgMs: summary.totalTurnAvgMs,
        },
        tokenUsage: summary.tokenUsage,
        interruptions: Number(session?.interruptionState?.count || 0),
        silenceDurationMs: Number(session?.metrics?.silenceDurationMs || 0),
        errorCount: Number(session?.metrics?.errors || 0),
        transcript: session?.transcript || { user: [], assistant: [] },
        summary: session?.memory?.summary || "",
      },
      $setOnInsert: { callId: session.callId },
    },
    { upsert: true, new: true, runValidators: true },
  );
};

