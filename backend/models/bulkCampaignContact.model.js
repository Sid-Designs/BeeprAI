import mongoose from "mongoose";

const BulkCampaignContactSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BulkCampaign",
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, trim: true, default: "" },
    phoneNumber: { type: String, required: true, trim: true, index: true },
    status: {
      type: String,
      enum: ["pending", "calling", "completed", "failed", "skipped"],
      default: "pending",
      index: true,
    },
    sessionId: { type: String, trim: true, default: "" },
    roomName: { type: String, trim: true, default: "" },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, trim: true, default: "" },
    calledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

BulkCampaignContactSchema.index({ campaignId: 1, status: 1, createdAt: 1 });

export default mongoose.model("BulkCampaignContact", BulkCampaignContactSchema);
