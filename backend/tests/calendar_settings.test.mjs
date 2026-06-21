import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WORKING_HOURS,
  getActiveWorkingHours,
  mergeWorkingHoursForTenant,
  normalizeWorkingHours,
} from "../services/calendar/calendarSettings.service.js";

test("mergeWorkingHoursForTenant returns all seven days", () => {
  const merged = mergeWorkingHoursForTenant([
    { day: 1, start: "10:00", end: "17:00", enabled: true },
    { day: 5, start: "11:00", end: "15:00", enabled: true },
  ]);

  assert.equal(merged.length, 7);
  assert.equal(merged[1].start, "10:00");
  assert.equal(merged[5].start, "11:00");
  assert.equal(merged[0].enabled, false);
  assert.equal(merged[6].enabled, false);
});

test("getActiveWorkingHours excludes disabled weekend days", () => {
  const active = getActiveWorkingHours(DEFAULT_WORKING_HOURS);
  assert.deepEqual(
    active.map((entry) => entry.day),
    [1, 2, 3, 4, 5],
  );
});

test("normalizeWorkingHours keeps enabled weekend days when configured", () => {
  const normalized = normalizeWorkingHours([
    { day: 6, start: "10:00", end: "14:00", enabled: true },
  ]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].day, 6);
  assert.equal(normalized[0].enabled, true);
});
