import test from "node:test";
import assert from "node:assert/strict";
import {
  filterAvailableSlots,
  generateSlotCandidates,
} from "../services/calendar/availability.service.js";
import {
  getWeekdayInTimeZone,
  isPastCalendarDate,
  isSlotStartInPast,
  overlaps,
  parseTimeToMinutes,
  zonedDateTimeToUtc,
} from "../services/calendar/calendarTime.service.js";

test("overlaps detects intersecting appointment ranges", () => {
  const start = new Date("2026-06-20T09:00:00.000Z");
  const end = new Date("2026-06-20T09:30:00.000Z");

  assert.equal(overlaps(start, end, new Date("2026-06-20T09:15:00.000Z"), new Date("2026-06-20T09:45:00.000Z")), true);
  assert.equal(overlaps(start, end, new Date("2026-06-20T09:30:00.000Z"), new Date("2026-06-20T10:00:00.000Z")), false);
  assert.equal(overlaps(start, end, new Date("2026-06-20T08:30:00.000Z"), new Date("2026-06-20T09:00:00.000Z")), false);
});

test("generateSlotCandidates builds spaced slots from working hours", () => {
  const slots = generateSlotCandidates({
    dateStr: "2026-06-20",
    timeZone: "UTC",
    dayConfig: { day: 5, start: "09:00", end: "10:30" },
    slotDurationMinutes: 30,
    bufferMinutes: 0,
  });

  assert.equal(slots.length, 3);
  assert.equal(slots[0].startAt.toISOString(), "2026-06-20T09:00:00.000Z");
  assert.equal(slots[0].endAt.toISOString(), "2026-06-20T09:30:00.000Z");
  assert.equal(slots[2].startAt.toISOString(), "2026-06-20T10:00:00.000Z");
});

test("filterAvailableSlots removes booked and past slots", () => {
  const slots = generateSlotCandidates({
    dateStr: "2026-06-20",
    timeZone: "UTC",
    dayConfig: { day: 5, start: "09:00", end: "11:00" },
    slotDurationMinutes: 30,
    bufferMinutes: 0,
  });

  const available = filterAvailableSlots({
    slots,
    appointments: [
      {
        _id: "a1",
        status: "scheduled",
        startAt: new Date("2026-06-20T09:30:00.000Z"),
        endAt: new Date("2026-06-20T10:00:00.000Z"),
      },
    ],
    now: new Date("2026-06-20T08:00:00.000Z"),
  });

  assert.equal(available.length, 3);
  assert.equal(available[0].startAt.toISOString(), "2026-06-20T09:00:00.000Z");
  assert.equal(available[1].startAt.toISOString(), "2026-06-20T10:00:00.000Z");
  assert.equal(available[2].startAt.toISOString(), "2026-06-20T10:30:00.000Z");
});

test("filterAvailableSlots ignores cancelled appointments", () => {
  const slots = generateSlotCandidates({
    dateStr: "2026-06-20",
    timeZone: "UTC",
    dayConfig: { day: 5, start: "09:00", end: "10:00" },
    slotDurationMinutes: 30,
    bufferMinutes: 0,
  });

  const available = filterAvailableSlots({
    slots,
    appointments: [
      {
        _id: "a1",
        status: "cancelled",
        startAt: new Date("2026-06-20T09:00:00.000Z"),
        endAt: new Date("2026-06-20T09:30:00.000Z"),
      },
    ],
    now: new Date("2026-06-20T08:00:00.000Z"),
  });

  assert.equal(available.length, 2);
});

test("calendar time helpers parse minutes and weekdays", () => {
  assert.equal(parseTimeToMinutes("09:30"), 570);
  assert.equal(getWeekdayInTimeZone("2026-06-20", "UTC"), 6);
  assert.equal(zonedDateTimeToUtc("2026-06-20", "15:00", "UTC").toISOString(), "2026-06-20T15:00:00.000Z");
});

test("isPastCalendarDate and isSlotStartInPast guard booking windows", () => {
  const now = new Date("2026-06-20T15:00:00.000Z");
  assert.equal(isPastCalendarDate("2026-06-19", "UTC", now), true);
  assert.equal(isPastCalendarDate("2026-06-20", "UTC", now), false);
  assert.equal(isSlotStartInPast(new Date("2026-06-20T14:00:00.000Z"), now), true);
  assert.equal(isSlotStartInPast(new Date("2026-06-20T16:00:00.000Z"), now), false);
});
