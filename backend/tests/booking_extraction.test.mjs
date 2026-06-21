import test from "node:test";
import assert from "node:assert/strict";
import { extractLeadData } from "../services/conversation/dataExtraction.service.js";
import { evaluateBookingProgress } from "../services/conversation/bookingFlow.service.js";

test("extractLeadData parses combined name and appointment request", () => {
  const data = extractLeadData(
    "My name is Siddhesh Book appointment for tomorrow around 2 PM.",
  );

  assert.equal(data.name, "Siddhesh");
  assert.equal(data.preferred_date, "tomorrow");
  assert.equal(data.preferred_time, "2 pm");
  assert.equal(data.appointmentRequested, true);
});

test("evaluateBookingProgress treats combined booking utterance as complete", () => {
  const data = extractLeadData(
    "My name is Siddhesh Book appointment for tomorrow around 2 PM.",
  );
  const progress = evaluateBookingProgress({
    collectedData: data,
    extractedData: data,
    query: "My name is Siddhesh Book appointment for tomorrow around 2 PM.",
    policy: { objective: "appointment_booking" },
  });

  assert.equal(progress.allRequiredFilled, true);
  assert.equal(progress.hasName, true);
  assert.equal(progress.hasDate, true);
  assert.equal(progress.hasTime, true);
});
