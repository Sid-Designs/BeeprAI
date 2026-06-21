import mongoose from "mongoose";

const { Schema } = mongoose;

const RealtimeCallMetricSchema = new Schema(
  {
    callId: { type: String, required: true, index: true },
    roomId: { type: String, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", index: true },
    callerNumber: { type: String, default: "" },
    provider: { type: String, default: "openai_realtime" },
    latencies: {
      wsRoundtripAvgMs: { type: Number, default: 0 },
      modelFirstTokenAvgMs: { type: Number, default: 0 },
      ttsSynthesisAvgMs: { type: Number, default: 0 },
      totalTurnAvgMs: { type: Number, default: 0 },
    },
    tokenUsage: {
      input: { type: Number, default: 0 },
      output: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    interruptions: { type: Number, default: 0 },
    silenceDurationMs: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    quality: {
      confidence: { type: Number, default: 0 },
      avgRms: { type: Number, default: 0 },
    },
    transcript: {
      user: { type: [String], default: [] },
      assistant: { type: [String], default: [] },
    },
    summary: { type: String, default: "" },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("RealtimeCallMetric", RealtimeCallMetricSchema);

