import mongoose from "mongoose";

const { Schema } = mongoose;

const WorkingHoursSchema = new Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    start: { type: String, trim: true, required: true },
    end: { type: String, trim: true, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const TenantCalendarSettingsSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      unique: true,
      index: true,
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },
    workingHours: {
      type: [WorkingHoursSchema],
      default: [],
    },
    slotDurationMinutes: {
      type: Number,
      min: 5,
      max: 240,
      default: 30,
    },
    bufferMinutes: {
      type: Number,
      min: 0,
      max: 120,
      default: 10,
    },
    maxDailyAppointments: {
      type: Number,
      min: 1,
      default: null,
    },
    blackoutDates: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

export default mongoose.model("TenantCalendarSettings", TenantCalendarSettingsSchema);
