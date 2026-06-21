import mongoose from "mongoose";

const { Schema } = mongoose;

const AppointmentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      default: "",
      index: true,
      sparse: true,
    },
    customerName: {
      type: String,
      trim: true,
      default: "",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    startAt: {
      type: Date,
      required: true,
      index: true,
    },
    endAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "cancelled", "completed", "no_show", "hold"],
      default: "scheduled",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      enum: ["ai_agent", "manual"],
      default: "manual",
    },
  },
  { timestamps: true },
);

AppointmentSchema.index({ tenantId: 1, startAt: 1, endAt: 1, status: 1 });

export default mongoose.model("Appointment", AppointmentSchema);
