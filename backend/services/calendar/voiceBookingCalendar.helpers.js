import {
  formatDateInTimeZone,
  getZonedParts,
  isPastCalendarDate,
  zonedDateTimeToUtc,
} from "./calendarTime.service.js";
import { getAvailableSlots } from "./availability.service.js";
import { getCalendarSettings } from "./calendarSettings.service.js";
import { normalizeSpokenTimeText, extractEnglishClockTime } from "../conversation/indicDateTime.service.js";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const addDaysInTimeZone = (dateStr, days, timeZone) => {
  const anchor = zonedDateTimeToUtc(dateStr, "12:00", timeZone);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return formatDateInTimeZone(anchor, timeZone);
};

const nextWeekdayInTimeZone = (dateStr, targetDay, timeZone) => {
  let cursor = dateStr;
  for (let i = 0; i < 8; i += 1) {
    const anchor = zonedDateTimeToUtc(cursor, "12:00", timeZone);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(anchor);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    if (map[weekday] === targetDay) return cursor;
    cursor = addDaysInTimeZone(cursor, 1, timeZone);
  }
  return dateStr;
};

export const resolveDateString = (preferredDate, timeZone, now = new Date()) => {
  const text = String(preferredDate || "")
    .trim()
    .toLowerCase();
  if (!text) return null;

  const finalize = (dateStr) => {
    if (!dateStr || isPastCalendarDate(dateStr, timeZone, now)) return null;
    return dateStr;
  };

  if (/\b(yesterday|day before yesterday|last week)\b/i.test(text)) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return finalize(text);
  }

  const today = formatDateInTimeZone(now, timeZone);
  if (text === "today" || text === "aaj") return finalize(today);
  if (text === "tomorrow" || text === "udya" || text === "कल") {
    return finalize(addDaysInTimeZone(today, 1, timeZone));
  }
  if (text.includes("day after") || /\bafter\s+tomorrow\b/.test(text)) {
    return finalize(addDaysInTimeZone(today, 2, timeZone));
  }

  const ordinalOnly = text.match(/^(\d{1,2})(?:st|nd|rd|th)?$/);
  if (ordinalOnly) {
    const targetDay = Number.parseInt(ordinalOnly[1], 10);
    if (targetDay >= 1 && targetDay <= 31) {
      let cursor = today;
      for (let i = 0; i < 62; i += 1) {
        const anchor = zonedDateTimeToUtc(cursor, "12:00", timeZone);
        const parts = getZonedParts(anchor, timeZone);
        if (parts.day === targetDay) {
          const resolved = finalize(cursor);
          if (resolved) return resolved;
        }
        cursor = addDaysInTimeZone(cursor, 1, timeZone);
      }
    }
  }

  const dayIndex = DAY_NAMES.findIndex((day) => text.includes(day));
  if (dayIndex >= 0) return finalize(nextWeekdayInTimeZone(today, dayIndex, timeZone));

  const parsed = Date.parse(`${preferredDate} ${now.getFullYear()}`);
  if (!Number.isNaN(parsed)) {
    return finalize(formatDateInTimeZone(new Date(parsed), timeZone));
  }

  return null;
};

export const parsePreferredTimeToMinutes = (preferredTime) => {
  const normalized = normalizeSpokenTimeText(String(preferredTime || "")).trim().toLowerCase();
  if (!normalized) return null;

  const clock = extractEnglishClockTime(normalized);
  const clockMatch = (clock || normalized).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (clockMatch) {
    let hour = Number(clockMatch[1]);
    const minute = Number(clockMatch[2] || 0);
    if (clockMatch[3].toLowerCase() === "pm" && hour < 12) hour += 12;
    if (clockMatch[3].toLowerCase() === "am" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }

  const text = normalized;

  const morningHour = text.match(/(\d{1,2})\s+morning/);
  if (morningHour) return Number(morningHour[1]) * 60;

  if (text.includes("morning") || text.includes("सकाळ")) return 10 * 60;
  if (text.includes("afternoon") || text.includes("दुपार")) return 14 * 60;
  if (text.includes("evening") || text.includes("संध्याकाळ")) return 17 * 60;

  const oclockMatch = text.match(/(\d{1,2})\s*o'?clock/i);
  if (oclockMatch) return Number(oclockMatch[1]) * 60;

  const bare = text.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (bare) {
    let hour = Number(bare[1]);
    const minute = Number(bare[2] || 0);
    if (hour >= 1 && hour <= 7) hour += 12;
    return hour * 60 + minute;
  }

  return null;
};

export const formatSlotLabel = (slot, timeZone) => {
  const parts = getZonedParts(new Date(slot.startAt), timeZone);
  const hour12 = parts.hour % 12 || 12;
  const ampm = parts.hour >= 12 ? "PM" : "AM";
  const minute = String(parts.minute).padStart(2, "0");
  return `${hour12}:${minute} ${ampm}`;
};

export const pickNearestSlot = (slots = [], preferredTime = "", timeZone = "UTC") => {
  if (!Array.isArray(slots) || !slots.length) return null;
  const target = parsePreferredTimeToMinutes(preferredTime);
  if (target == null) return slots[0];

  let best = slots[0];
  let bestDiff = Infinity;
  for (const slot of slots) {
    const parts = getZonedParts(new Date(slot.startAt), timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    const diff = Math.abs(minutes - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  return best;
};

export const matchOfferedSlotSelection = (query = "", offeredSlots = [], timeZone = "UTC") => {
  if (!Array.isArray(offeredSlots) || !offeredSlots.length) return null;
  const clock = extractEnglishClockTime(normalizeSpokenTimeText(String(query || "")));
  const target = parsePreferredTimeToMinutes(clock || query);
  if (target == null) return null;

  for (const slot of offeredSlots) {
    const parts = getZonedParts(new Date(slot.startAt), timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    if (Math.abs(minutes - target) <= 25) return slot;
  }
  return pickNearestSlot(offeredSlots, clock || query, timeZone);
};

export const matchSlotFromPreferences = async (tenantId, collectedData = {}, now = new Date()) => {
  if (!tenantId) {
    return { dateStr: null, slots: [], matched: null };
  }

  const settings = await getCalendarSettings(tenantId);
  const timeZone = settings.timezone || "UTC";
  const preferredDate = collectedData.preferred_date || collectedData.timeline;
  const preferredTime = collectedData.preferred_time;
  const dateStr = resolveDateString(preferredDate, timeZone, now);

  if (!dateStr || isPastCalendarDate(dateStr, timeZone, now)) {
    return { dateStr: null, slots: [], matched: null };
  }

  const slotPayloads = await getAvailableSlots(tenantId, dateStr, { now });
  const slots = slotPayloads.map((slot) => ({
    startAt: slot.startAt,
    endAt: slot.endAt,
  }));

  const targetMinutes = parsePreferredTimeToMinutes(preferredTime);
  if (targetMinutes == null || !slots.length) {
    return { dateStr, slots, matched: slots[0] || null };
  }

  let matched = null;
  let bestDiff = Infinity;
  for (const slot of slots) {
    const parts = getZonedParts(new Date(slot.startAt), timeZone);
    const minutes = parts.hour * 60 + parts.minute;
    const diff = Math.abs(minutes - targetMinutes);
    if (diff < bestDiff) {
      bestDiff = diff;
      matched = slot;
    }
  }

  const exactOnly = bestDiff <= 15;
  return { dateStr, slots, matched: exactOnly ? matched : null };
};
