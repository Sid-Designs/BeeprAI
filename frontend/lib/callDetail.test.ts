import test from "node:test";
import assert from "node:assert/strict";
import {
  analysisStatusTone,
  formatCallDuration,
  formatCollectedEntries,
  formatIntentInsight,
  isAnalysisPending,
  labelAnalysisStatus,
  labelEndReason,
  labelOutcome,
} from "./callDetail.ts";

test("formatCallDuration formats seconds into minutes and seconds", () => {
  assert.equal(formatCallDuration(0), "—");
  assert.equal(formatCallDuration(45), "45s");
  assert.equal(formatCallDuration(198), "3m 18s");
});

test("labelEndReason maps known end reasons to plain English", () => {
  assert.equal(labelEndReason("user_not_interested"), "Customer not interested");
  assert.equal(labelEndReason("callback_scheduled"), "Callback requested");
  assert.equal(labelEndReason("room_ended"), "Call room closed");
});

test("labelEndReason handles partial matches and empty values", () => {
  assert.equal(labelEndReason("customer_not_interested_anymore"), "Customer not interested");
  assert.equal(labelEndReason(""), "Not recorded");
  assert.equal(labelEndReason("custom_end_signal"), "Custom End Signal");
});

test("labelOutcome and labelAnalysisStatus provide readable labels", () => {
  assert.equal(labelOutcome("appointment_booked"), "Appointment booked");
  assert.equal(labelOutcome(""), "In progress");
  assert.equal(labelAnalysisStatus("processing"), "Processing");
  assert.equal(analysisStatusTone("failed"), "error");
  assert.equal(analysisStatusTone("completed"), "success");
});

test("isAnalysisPending reflects pending and processing states", () => {
  assert.equal(isAnalysisPending({ analysisStatus: "pending" }), true);
  assert.equal(isAnalysisPending({ analysisStatus: "processing" }), true);
  assert.equal(isAnalysisPending({ analysisStatus: "completed" }), false);
});

test("formatIntentInsight summarizes intent metadata", () => {
  assert.equal(formatIntentInsight(null), "Unknown");
  assert.equal(
    formatIntentInsight({
      primaryIntent: "course_inquiry",
      confidence: 0.82,
      subTopics: ["placement", "fees"],
    }),
    "Course Inquiry · 82% confidence · Topics: Placement, Fees",
  );
});

test("formatCollectedEntries skips empty values and formats keys", () => {
  const entries = formatCollectedEntries({
    name: "Rahul",
    preferred_date: "tomorrow",
    empty: "",
    notes: null,
  });

  assert.deepEqual(entries, [
    { key: "Name", value: "Rahul" },
    { key: "Preferred Date", value: "tomorrow" },
  ]);
});
