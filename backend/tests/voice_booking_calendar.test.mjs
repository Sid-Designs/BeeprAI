import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysInTimeZone,
  parsePreferredTimeToMinutes,
  resolveDateString,
} from "../services/calendar/voiceBookingCalendar.helpers.js";

test("resolveDateString maps relative dates in a timezone", () => {
  const now = new Date("2026-06-20T10:00:00.000Z");
  assert.equal(resolveDateString("today", "UTC", now), "2026-06-20");
  assert.equal(resolveDateString("tomorrow", "UTC", now), "2026-06-21");
  assert.equal(resolveDateString("2026-06-25", "UTC", now), "2026-06-25");
});

test("resolveDateString rejects past and yesterday dates", () => {
  const now = new Date("2026-06-20T10:00:00.000Z");
  assert.equal(resolveDateString("yesterday", "UTC", now), null);
  assert.equal(resolveDateString("2026-06-18", "UTC", now), null);
  assert.equal(resolveDateString("18 June", "UTC", now), null);
});

test("addDaysInTimeZone advances calendar dates", () => {
  assert.equal(addDaysInTimeZone("2026-06-20", 2, "UTC"), "2026-06-22");
});

test("parsePreferredTimeToMinutes handles common voice time phrases", () => {
  assert.equal(parsePreferredTimeToMinutes("2 pm"), 14 * 60);
  assert.equal(parsePreferredTimeToMinutes("10:30 am"), 10 * 60 + 30);
  assert.equal(parsePreferredTimeToMinutes("morning"), 10 * 60);
  assert.equal(parsePreferredTimeToMinutes("3"), 15 * 60);
});
