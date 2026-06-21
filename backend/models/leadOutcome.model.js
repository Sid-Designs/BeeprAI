import mongoose from "mongoose";

const { Schema } = mongoose;

const LeadOutcomeSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    roomName: {
      type: String,
      trim: true,
      default: "",
    },
    objective: {
      type: String,
      trim: true,
      default: "custom",
    },
    stage: {
      type: String,
      trim: true,
      default: "opening",
    },
    leadStatus: {
      type: String,
      enum: [
        "new",
        "interested",
        "qualified",
        "unsure",
        "not_interested",
        "closed",
      ],
      default: "new",
    },
    collectedData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    callbackRequested: {
      type: Boolean,
      default: false,
    },
    callbackSchedule: {
      type: Schema.Types.Mixed,
      default: null,
    },
    summary: {
      type: String,
      trim: true,
      default: "",
    },
    endReason: {
      type: String,
      trim: true,
      default: "",
    },
    isClosed: {
      type: Boolean,
      default: false,
    },
    turnCount: {
      type: Number,
      default: 0,
    },
    lastUserMessage: {
      type: String,
      trim: true,
      default: "",
    },
    lastAssistantMessage: {
      type: String,
      trim: true,
      default: "",
    },
    telemetry: {
      type: Schema.Types.Mixed,
      default: {},
    },
    intentInsight: {
      primaryIntent: { type: String, trim: true, default: "unknown" },
      confidence: { type: Number, default: 0 },
      intentStatus: { type: String, trim: true, default: "pending" },
      intentResolvedAtTurn: { type: Number, default: null },
      intentResolutionMs: { type: Number, default: null },
      bookingReadiness: { type: String, trim: true, default: "not_asked" },
      latestStage: { type: String, trim: true, default: "" },
      latestDirective: { type: String, trim: true, default: "" },
    },
    learning: {
      type: Schema.Types.Mixed,
      default: {},
    },
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

LeadOutcomeSchema.index({ tenantId: 1, agentId: 1, createdAt: -1 });
LeadOutcomeSchema.index({ tenantId: 1, agentId: 1, leadStatus: 1 });

export default mongoose.model("LeadOutcome", LeadOutcomeSchema);
