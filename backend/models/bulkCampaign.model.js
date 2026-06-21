import mongoose from "mongoose";

const BulkCampaignSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    groupType: {
      type: String,
      enum: ["cold_calling", "appointment", "follow_up", "custom"],
      default: "cold_calling",
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    callObjective: { type: String, trim: true, default: "" },
    callConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ["draft", "running", "paused", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    delayBetweenCallsSec: { type: Number, default: 8, min: 3, max: 120 },
    stats: {
      total: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      calling: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
    },
    currentContactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BulkCampaignContact",
      default: null,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

BulkCampaignSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.model("BulkCampaign", BulkCampaignSchema);
