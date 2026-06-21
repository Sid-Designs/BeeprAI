import TenantCalendarSettings from "../../models/tenantCalendarSettings.model.js";
import { AppError } from "../../utils/AppError.js";

export const WEEKDAY_NUMBERS = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_WORKING_HOURS = [
  { day: 0, start: "09:00", end: "18:00", enabled: false },
  { day: 1, start: "09:00", end: "18:00", enabled: true },
  { day: 2, start: "09:00", end: "18:00", enabled: true },
  { day: 3, start: "09:00", end: "18:00", enabled: true },
  { day: 4, start: "09:00", end: "18:00", enabled: true },
  { day: 5, start: "09:00", end: "18:00", enabled: true },
  { day: 6, start: "09:00", end: "18:00", enabled: false },
];

const DEFAULT_SLOT_DURATION_MINUTES = Number.parseInt(
  process.env.DEFAULT_SLOT_DURATION_MINUTES || "30",
  10,
);

const DEFAULT_TIMEZONE = process.env.DEFAULT_CALENDAR_TIMEZONE || "Asia/Kolkata";

export const buildDefaultCalendarSettings = (tenantId) => ({
  tenantId,
  timezone: DEFAULT_TIMEZONE,
  workingHours: DEFAULT_WORKING_HOURS.map((entry) => ({ ...entry })),
  slotDurationMinutes: DEFAULT_SLOT_DURATION_MINUTES,
  bufferMinutes: 10,
  maxDailyAppointments: null,
  blackoutDates: [],
});

const normalizeWorkingHourEntry = (entry = {}) => {
  const day = Number(entry.day);
  const start = String(entry.start || "").trim();
  const end = String(entry.end || "").trim();
  const enabled = entry.enabled !== false;

  if (!Number.isInteger(day) || day < 0 || day > 6 || !start || !end) {
    return null;
  }

  return { day, start, end, enabled };
};

export const normalizeWorkingHours = (workingHours) => {
  if (!Array.isArray(workingHours)) {
    return DEFAULT_WORKING_HOURS.map((entry) => ({ ...entry }));
  }

  return workingHours
    .map((entry) => normalizeWorkingHourEntry(entry))
    .filter(Boolean);
};

export const mergeWorkingHoursForTenant = (workingHours = []) => {
  const normalized = normalizeWorkingHours(workingHours);
  const byDay = new Map(normalized.map((entry) => [entry.day, entry]));

  return WEEKDAY_NUMBERS.map((day) => {
    const existing = byDay.get(day);
    if (existing) return { ...existing };
    const fallback = DEFAULT_WORKING_HOURS.find((entry) => entry.day === day);
    return { ...(fallback || { day, start: "09:00", end: "18:00", enabled: false }) };
  });
};

export const getActiveWorkingHours = (workingHours = []) =>
  mergeWorkingHoursForTenant(workingHours).filter((entry) => entry.enabled !== false);

const normalizeCalendarSettings = (record = {}) => ({
  ...record,
  timezone: String(record.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
  workingHours: mergeWorkingHoursForTenant(record.workingHours),
  slotDurationMinutes: Number(record.slotDurationMinutes) || DEFAULT_SLOT_DURATION_MINUTES,
  bufferMinutes: Number.isFinite(Number(record.bufferMinutes)) ? Number(record.bufferMinutes) : 10,
  maxDailyAppointments:
    record.maxDailyAppointments === null || record.maxDailyAppointments === undefined
      ? null
      : Number(record.maxDailyAppointments),
  blackoutDates: Array.isArray(record.blackoutDates)
    ? record.blackoutDates.map((date) => String(date).trim()).filter(Boolean)
    : [],
});

export const getCalendarSettings = async (tenantId) => {
  const record = await TenantCalendarSettings.findOne({ tenantId }).lean();
  if (record) return normalizeCalendarSettings(record);
  return buildDefaultCalendarSettings(tenantId);
};

export const upsertCalendarSettings = async (tenantId, payload = {}) => {
  if (!tenantId) {
    throw new AppError("tenantId is required", 400, "TENANT_REQUIRED");
  }

  const mergedHours = mergeWorkingHoursForTenant(normalizeWorkingHours(payload.workingHours));
  const maxDailyAppointments =
    payload.maxDailyAppointments === null ||
    payload.maxDailyAppointments === undefined ||
    payload.maxDailyAppointments === ""
      ? null
      : Number(payload.maxDailyAppointments);

  if (maxDailyAppointments != null && (!Number.isFinite(maxDailyAppointments) || maxDailyAppointments < 1)) {
    throw new AppError("maxDailyAppointments must be at least 1", 400, "INVALID_DAILY_LIMIT");
  }

  const update = {
    timezone: String(payload.timezone || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE,
    workingHours: mergedHours,
    slotDurationMinutes: Number(payload.slotDurationMinutes) || DEFAULT_SLOT_DURATION_MINUTES,
    bufferMinutes: Number.isFinite(Number(payload.bufferMinutes))
      ? Number(payload.bufferMinutes)
      : 10,
    maxDailyAppointments,
    blackoutDates: Array.isArray(payload.blackoutDates)
      ? payload.blackoutDates.map((date) => String(date).trim()).filter(Boolean)
      : [],
  };

  const saved = await TenantCalendarSettings.findOneAndUpdate(
    { tenantId },
    { $set: { tenantId, ...update } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  ).lean();

  return normalizeCalendarSettings(saved);
};
