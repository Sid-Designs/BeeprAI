import Appointment from "../../models/appointment.model.js";
import { AppError } from "../../utils/AppError.js";
import { getCalendarSettings } from "./calendarSettings.service.js";
import {
  formatDateInTimeZone,
  getWeekdayInTimeZone,
  isPastCalendarDate,
  isSlotStartInPast,
  overlaps,
  parseTimeToMinutes,
  zonedDateTimeToUtc,
} from "./calendarTime.service.js";

const ACTIVE_APPOINTMENT_STATUSES = ["scheduled", "confirmed", "hold", "completed", "no_show"];

const toDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const generateSlotCandidates = ({
  dateStr,
  timeZone,
  dayConfig,
  slotDurationMinutes,
  bufferMinutes,
}) => {
  if (!dayConfig) return [];

  const startMin = parseTimeToMinutes(dayConfig.start);
  const endMin = parseTimeToMinutes(dayConfig.end);
  if (startMin == null || endMin == null || endMin <= startMin) return [];

  const step = slotDurationMinutes + bufferMinutes;
  const slots = [];

  for (let cursor = startMin; cursor + slotDurationMinutes <= endMin; cursor += step) {
    const startHour = String(Math.floor(cursor / 60)).padStart(2, "0");
    const startMinute = String(cursor % 60).padStart(2, "0");
    const endCursor = cursor + slotDurationMinutes;
    const endHour = String(Math.floor(endCursor / 60)).padStart(2, "0");
    const endMinute = String(endCursor % 60).padStart(2, "0");

    slots.push({
      startAt: zonedDateTimeToUtc(dateStr, `${startHour}:${startMinute}`, timeZone),
      endAt: zonedDateTimeToUtc(dateStr, `${endHour}:${endMinute}`, timeZone),
    });
  }

  return slots;
};

export const filterAvailableSlots = ({
  slots,
  appointments = [],
  now = new Date(),
  excludeAppointmentId = null,
}) => {
  const nowMs = now.getTime();

  return slots.filter((slot) => {
    if (slot.startAt.getTime() < nowMs) return false;

    return !appointments.some((appointment) => {
      if (excludeAppointmentId && String(appointment._id) === String(excludeAppointmentId)) {
        return false;
      }
      if (appointment.status === "cancelled") return false;
      return overlaps(slot.startAt, slot.endAt, appointment.startAt, appointment.endAt);
    });
  });
};

const resolveDayBounds = (dateStr, timeZone) => {
  const startAt = zonedDateTimeToUtc(dateStr, "00:00", timeZone);
  const endAt = zonedDateTimeToUtc(dateStr, "23:59", timeZone);
  endAt.setSeconds(59, 999);
  return { startAt, endAt };
};

const listAppointmentsInRange = async (tenantId, from, to) =>
  Appointment.find({
    tenantId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    startAt: { $lt: to },
    endAt: { $gt: from },
  })
    .sort({ startAt: 1 })
    .lean();

export const getAvailableSlots = async (tenantId, dateStr, { now = new Date() } = {}) => {
  if (!tenantId) {
    throw new AppError("tenantId is required", 400, "TENANT_REQUIRED");
  }

  const settings = await getCalendarSettings(tenantId);
  const timeZone = settings.timezone || "UTC";

  if (isPastCalendarDate(dateStr, timeZone, now)) {
    return [];
  }

  if ((settings.blackoutDates || []).includes(dateStr)) {
    return [];
  }

  const weekday = getWeekdayInTimeZone(dateStr, timeZone);
  const dayConfig = (settings.workingHours || []).find(
    (entry) => entry.day === weekday && entry.enabled !== false,
  );
  if (!dayConfig) return [];

  const slotDurationMinutes = Number(settings.slotDurationMinutes) || 30;
  const bufferMinutes = Number(settings.bufferMinutes) || 0;
  const candidates = generateSlotCandidates({
    dateStr,
    timeZone,
    dayConfig,
    slotDurationMinutes,
    bufferMinutes,
  });

  const { startAt, endAt } = resolveDayBounds(dateStr, timeZone);
  const appointments = await listAppointmentsInRange(tenantId, startAt, endAt);

  if (settings.maxDailyAppointments) {
    const bookedCount = appointments.filter((item) => item.status !== "hold").length;
    if (bookedCount >= settings.maxDailyAppointments) {
      return [];
    }
  }

  return filterAvailableSlots({ slots: candidates, appointments, now }).map((slot) => ({
    startAt: slot.startAt.toISOString(),
    endAt: slot.endAt.toISOString(),
  }));
};

export const isSlotAvailable = async (
  tenantId,
  startAt,
  endAt,
  { excludeAppointmentId = null, now = new Date() } = {},
) => {
  if (!tenantId) {
    throw new AppError("tenantId is required", 400, "TENANT_REQUIRED");
  }

  const start = toDate(startAt);
  const end = toDate(endAt);
  if (!start || !end || end <= start) {
    throw new AppError("Invalid appointment time range", 400, "INVALID_SLOT");
  }

  if (isSlotStartInPast(start, now)) {
    return false;
  }

  const settings = await getCalendarSettings(tenantId);
  const dateStr = formatDateInTimeZone(start, settings.timezone || "UTC");

  if ((settings.blackoutDates || []).includes(dateStr)) {
    return false;
  }

  const weekday = getWeekdayInTimeZone(dateStr, settings.timezone || "UTC");
  const dayConfig = (settings.workingHours || []).find(
    (entry) => entry.day === weekday && entry.enabled !== false,
  );
  if (!dayConfig) return false;

  const slots = generateSlotCandidates({
    dateStr,
    timeZone: settings.timezone || "UTC",
    dayConfig,
    slotDurationMinutes: Number(settings.slotDurationMinutes) || 30,
    bufferMinutes: Number(settings.bufferMinutes) || 0,
  });

  const fitsGeneratedSlot = slots.some(
    (slot) =>
      slot.startAt.getTime() === start.getTime() && slot.endAt.getTime() === end.getTime(),
  );
  if (!fitsGeneratedSlot) return false;

  const conflict = await Appointment.findOne({
    tenantId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES.filter((status) => status !== "cancelled") },
    startAt: { $lt: end },
    endAt: { $gt: start },
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
  }).lean();

  return !conflict;
};

export const listAppointments = async (tenantId, { from, to, includeCancelled = false } = {}) => {
  const query = { tenantId };
  if (!includeCancelled) {
    query.status = { $ne: "cancelled" };
  }

  const fromDate = toDate(from);
  const toDateValue = toDate(to);
  if (fromDate || toDateValue) {
    query.startAt = {};
    if (fromDate) query.startAt.$gte = fromDate;
    if (toDateValue) query.startAt.$lte = toDateValue;
  }

  return Appointment.find(query).sort({ startAt: 1 }).lean();
};

export const bookAppointment = async ({
  tenantId,
  sessionId = "",
  customerName = "",
  customerPhone = "",
  startAt,
  endAt,
  notes = "",
  createdBy = "manual",
  status = "scheduled",
}) => {
  const start = toDate(startAt);
  const end = toDate(endAt);
  if (!tenantId || !start || !end) {
    throw new AppError("tenantId, startAt, and endAt are required", 400, "INVALID_APPOINTMENT");
  }
  if (end <= start) {
    throw new AppError("endAt must be after startAt", 400, "INVALID_SLOT");
  }

  if (isSlotStartInPast(start)) {
    throw new AppError("Cannot book appointments in the past", 400, "PAST_SLOT");
  }

  const settings = await getCalendarSettings(tenantId);
  const dateStr = formatDateInTimeZone(start, settings.timezone || "UTC");

  if (isPastCalendarDate(dateStr, settings.timezone || "UTC")) {
    throw new AppError("Cannot book appointments on a past date", 400, "PAST_DATE");
  }

  const { startAt: dayStart, endAt: dayEnd } = resolveDayBounds(dateStr, settings.timezone || "UTC");

  if (settings.maxDailyAppointments) {
    const bookedCount = await Appointment.countDocuments({
      tenantId,
      status: { $in: ["scheduled", "confirmed", "completed", "no_show"] },
      startAt: { $gte: dayStart, $lte: dayEnd },
    });
    if (bookedCount >= settings.maxDailyAppointments) {
      throw new AppError("Daily appointment limit reached", 409, "DAILY_LIMIT");
    }
  }

  const available = await isSlotAvailable(tenantId, start, end);
  if (!available) {
    throw new AppError("Requested slot is not available", 409, "SLOT_UNAVAILABLE");
  }

  try {
    return await Appointment.create({
      tenantId,
      sessionId,
      customerName,
      customerPhone,
      startAt: start,
      endAt: end,
      notes,
      createdBy,
      status,
    });
  } catch (error) {
    const conflict = await Appointment.findOne({
      tenantId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES.filter((item) => item !== "cancelled") },
      startAt: { $lt: end },
      endAt: { $gt: start },
    }).lean();
    if (conflict) {
      throw new AppError("Requested slot is not available", 409, "SLOT_UNAVAILABLE");
    }
    throw error;
  }
};

export const updateAppointment = async (appointmentId, tenantId, updates = {}) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    throw new AppError("Appointment not found", 404, "APPOINTMENT_NOT_FOUND");
  }
  if (String(appointment.tenantId) !== String(tenantId)) {
    throw new AppError("Access denied for this appointment", 403, "FORBIDDEN");
  }

  const nextStatus = updates.status ?? appointment.status;
  const nextStart = updates.startAt ? toDate(updates.startAt) : appointment.startAt;
  const nextEnd = updates.endAt ? toDate(updates.endAt) : appointment.endAt;

  if (!nextStart || !nextEnd || nextEnd <= nextStart) {
    throw new AppError("Invalid appointment time range", 400, "INVALID_SLOT");
  }

  const isReschedule =
    nextStart.getTime() !== appointment.startAt.getTime() ||
    nextEnd.getTime() !== appointment.endAt.getTime();

  if (isReschedule && nextStatus !== "cancelled") {
    const available = await isSlotAvailable(tenantId, nextStart, nextEnd, {
      excludeAppointmentId: appointment._id,
    });
    if (!available) {
      throw new AppError("Requested slot is not available", 409, "SLOT_UNAVAILABLE");
    }
  }

  if (updates.customerName !== undefined) appointment.customerName = String(updates.customerName);
  if (updates.customerPhone !== undefined) appointment.customerPhone = String(updates.customerPhone);
  if (updates.notes !== undefined) appointment.notes = String(updates.notes);
  if (updates.status !== undefined) appointment.status = updates.status;
  appointment.startAt = nextStart;
  appointment.endAt = nextEnd;

  await appointment.save();
  return appointment.toObject();
};

export const getAppointmentById = async (appointmentId) =>
  Appointment.findById(appointmentId).lean();
