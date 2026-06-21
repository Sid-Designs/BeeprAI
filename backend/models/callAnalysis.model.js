import mongoose from "mongoose";

const { Schema } = mongoose;

const TranscriptTurnSchema = new Schema(
  {
    speaker: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    timestamp: { type: Date, required: true },
    message: { type: String, trim: true, default: "" },
    turnIndex: { type: Number, default: 0 },
  },
  { _id: false },
);

const CallAnalysisSchema = new Schema(
  {
    callId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true, unique: true },
    roomName: { type: String, trim: true, default: "", index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    agentId: { type: Schema.Types.ObjectId, ref: "Agent", required: true, index: true },
    phoneNumber: { type: String, trim: true, default: "" },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    summary: { type: String, trim: true, default: "" },
    primaryIntent: { type: String, trim: true, default: "unknown", index: true },
    secondaryIntents: { type: [String], default: [] },
    outcome: {
      type: String,
      enum: [
        "appointment_booked",
        "callback_scheduled",
        "qualified_lead",
        "information_provided",
        "not_interested",
        "abandoned",
        "unanswered",
        "unknown",
      ],
      default: "unknown",
      index: true,
    },
    leadScore: { type: Number, min: 0, max: 100, default: 0, index: true },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral",
      index: true,
    },
    objections: { type: [String], default: [] },
    collectedInformation: { type: Schema.Types.Mixed, default: {} },
    appointmentBooked: { type: Boolean, default: false, index: true },
    appointmentDate: { type: String, trim: true, default: "" },
    appointmentTime: { type: String, trim: true, default: "" },
    nextAction: { type: String, trim: true, default: "" },
    transcript: { type: [TranscriptTurnSchema], default: [] },
    analysisStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    analysisSource: {
      type: String,
      enum: ["llm", "rules", "hybrid"],
      default: "llm",
    },
    endReason: { type: String, trim: true, default: "" },
    triggerSource: { type: String, trim: true, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
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

CallAnalysisSchema.index({ tenantId: 1, agentId: 1, createdAt: -1 });
CallAnalysisSchema.index({ tenantId: 1, outcome: 1, createdAt: -1 });
CallAnalysisSchema.index({ tenantId: 1, appointmentBooked: 1, createdAt: -1 });

export default mongoose.model("CallAnalysis", CallAnalysisSchema);
