import mongoose from "mongoose";
import { PLANS } from "../config/plans.js";

const { Schema } = mongoose;

const MemberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "agentManager", "viewer"],
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const OrganizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
      index: true,
    },
    industry: {
      type: String,
      trim: true,
      default: "",
    },
    plan: {
      type: String,
      enum: Object.keys(PLANS),
      default: "free",
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: {
      type: [MemberSchema],
      default: [],
    },
    usageLimits: {
      maxCallsPerMonth: { type: Number },
      maxAgents: { type: Number },
    },
    usage: {
      callsUsed: { type: Number, default: 0 },
      agentsUsed: { type: Number, default: 0 },
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

OrganizationSchema.pre("save", function () {
  if (!this.isNew && !this.isModified("plan")) return;

  const planConfig = PLANS[this.plan];
  if (!planConfig) throw new Error("Invalid plan");

  this.usageLimits = {
    maxCallsPerMonth: planConfig.maxCallsPerMonth,
    maxAgents: planConfig.maxAgents,
  };
});

OrganizationSchema.index({ plan: 1 });
OrganizationSchema.index({ isActive: 1 });

export default mongoose.model("Organization", OrganizationSchema);
