import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDayHeading,
  formatSlotRange,
  groupAppointmentsByDay,
  slotKey,
  statusMeta,
} from "./calendar.ts";

test("formatSlotRange renders a readable time window", () => {
  const start = new Date("2026-06-20T09:00:00").toISOString();
  const end = new Date("2026-06-20T09:30:00").toISOString();
  const label = formatSlotRange(start, end);
  assert.match(label, /9:00/);
  assert.match(label, /9:30/);
});

test("groupAppointmentsByDay groups and sorts bookings", () => {
  const groups = groupAppointmentsByDay([
    {
      _id: "b",
      tenantId: "t1",
      startAt: new Date("2026-06-21T11:00:00").toISOString(),
      endAt: new Date("2026-06-21T11:30:00").toISOString(),
      status: "scheduled",
    },
    {
      _id: "a",
      tenantId: "t1",
      startAt: new Date("2026-06-20T10:00:00").toISOString(),
      endAt: new Date("2026-06-20T10:30:00").toISOString(),
      status: "confirmed",
    },
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].items[0]._id, "a");
  assert.ok(formatDayHeading(groups[0].items[0].startAt).length > 0);
});

test("statusMeta and slotKey helpers stay stable", () => {
  assert.equal(statusMeta("cancelled").label, "Cancelled");
  assert.equal(
    slotKey({
      startAt: "2026-06-20T09:00:00.000Z",
      endAt: "2026-06-20T09:30:00.000Z",
    }),
    "2026-06-20T09:00:00.000Z|2026-06-20T09:30:00.000Z",
  );
});
