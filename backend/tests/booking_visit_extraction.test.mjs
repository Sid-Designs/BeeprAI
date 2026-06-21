import test from "node:test";
import assert from "node:assert/strict";
import { extractLeadData, sanitizePersonName } from "../services/conversation/dataExtraction.service.js";
import { extractIndicDateTime } from "../services/conversation/indicDateTime.service.js";
import { resolveAppointmentVisitConfig } from "../services/conversation/appointmentVisit.service.js";
import { buildBookingConfirmationReply } from "../services/conversation/bookingFlow.service.js";

test("sanitizePersonName rejects STT false positives like not talking", () => {
  assert.equal(sanitizePersonName("not talking"), "");
  assert.equal(sanitizePersonName("not talking about MMS"), "");
});

test("extractLeadData does not treat i am not talking as a name", () => {
  const data = extractLeadData("I am not talking about MMS, I am talking about MCA course.");
  assert.equal(data.name, undefined);
  assert.equal(data.course, "MCA");
});

test("extractLeadData keeps full clock times like 11:40 am", () => {
  const data = extractLeadData("Book for tomorrow 11:40 AM");
  assert.equal(data.preferred_time, "11:40 am");
});

test("extractLeadData keeps 9:20 am from hindi tail phrases", () => {
  const data = extractLeadData("Hmm 9:20 am hai");
  assert.equal(data.preferred_time, "9:20 am");
});

test("extractLeadData parses 23rd july and STT million variant", () => {
  assert.equal(extractLeadData("book appointment for 23 july").preferred_date, "23 july");
  assert.equal(extractLeadData("book appointment for 23 million").preferred_date, "23 july");
});

test("extractIndicDateTime normalizes jewel STT to july", () => {
  assert.equal(extractIndicDateTime("visit on 25th Jewel around 10 am").preferred_date, "25th july");
});

test("sanitizePersonName rejects Rahul Can from STT bleed", () => {
  assert.equal(sanitizePersonName("Rahul Can"), "Rahul");
});

test("extractLeadData keeps Rahul from trailing can you bleed", () => {
  const data = extractLeadData("My name is Rahul Can you");
  assert.equal(data.name, "Rahul");
});

test("hasExplicitAppointmentDate ignores vague this year timeline", async () => {
  const { hasExplicitAppointmentDate, isBookingAffirmation } = await import(
    "../services/conversation/bookingFlow.service.js"
  );
  assert.equal(hasExplicitAppointmentDate("from this year", { timeline: "this year" }), false);
  assert.equal(hasExplicitAppointmentDate("Tomorrow 10 AM", {}), true);
  assert.equal(isBookingAffirmation("Yes visit"), false);
  assert.equal(isBookingAffirmation("Yes, confirm it"), true);
});

test("resolveAppointmentVisitConfig defaults to campus visit", () => {
  const visit = resolveAppointmentVisitConfig({});
  assert.equal(visit.type, "campus_visit");
  assert.match(visit.scheduleEn, /campus visit|college/i);
});

test("mergeSplitBookingDate combines ordinal and month fragments", async () => {
  const { mergeSplitBookingDate, formatBookingScheduleLabel } = await import(
    "../services/conversation/bookingFlow.service.js"
  );
  const merged = mergeSplitBookingDate({ preferred_date: "25th" }, "June around 10 AM", {});
  assert.match(merged.preferred_date, /25th\s+june/i);
  const label = formatBookingScheduleLabel({
    preferred_date: "25th june",
    preferred_time: "10 am",
  });
  assert.match(label, /25/i);
  assert.match(label, /june/i);
  assert.match(label, /10 am/i);
});

test("buildBookingClarifyReply handles what during name step", async () => {
  const { buildBookingClarifyReply } = await import("../services/conversation/bookingFlow.service.js");
  const reply = buildBookingClarifyReply({
    progress: { nextSlot: "name", hasDate: true, hasTime: true },
    scheduleLabel: "25 June at 10 am",
  });
  assert.match(reply, /name/i);
  assert.match(reply, /sorry/i);
});

test("buildBookingConfirmationReply uses visit label and ignores invalid names", () => {
  const reply = buildBookingConfirmationReply({
    schedule: { text: "tomorrow 11:40 am" },
    name: "not talking",
    policy: {},
  });
  assert.doesNotMatch(reply, /not talking/i);
  assert.match(reply, /college visit|campus visit/i);
  assert.match(reply, /11:40 am/i);
});
