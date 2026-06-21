import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStructuredTranscript,
  formatTranscriptForLLM,
  mergeTranscriptSources,
  extractPhoneFromIdentity,
} from "../services/postCall/transcriptAggregator.service.js";
import {
  buildRuleBasedAnalysis,
  inferOutcomeFromContext,
  validatePostCallAnalysis,
} from "../services/postCall/postCallLLM.service.js";

test("mergeTranscriptSources prefers the longer conversation", () => {
  const short = [{ role: "user", content: "Hi" }];
  const long = [
    { role: "assistant", content: "Hello, how can I help?" },
    { role: "user", content: "MCA fees?" },
    { role: "assistant", content: "Around 1.2 lakh per year." },
  ];

  const merged = mergeTranscriptSources(short, long);
  assert.equal(merged.length, 3);
  assert.equal(merged[1].content, "MCA fees?");
});

test("buildStructuredTranscript stores speaker timestamp and message", () => {
  const start = new Date("2026-06-15T10:00:00.000Z");
  const end = new Date("2026-06-15T10:01:00.000Z");
  const transcript = buildStructuredTranscript({
    messages: [
      { role: "user", content: "I want MCA admission" },
      { role: "assistant", content: "Sure, I can help with that." },
    ],
    startTime: start,
    endTime: end,
  });

  assert.equal(transcript.length, 2);
  assert.equal(transcript[0].speaker, "user");
  assert.equal(transcript[0].turnIndex, 1);
  assert.ok(transcript[0].timestamp instanceof Date);
  assert.match(formatTranscriptForLLM(transcript), /Caller: I want MCA admission/);
});

test("extractPhoneFromIdentity parses sip identities", () => {
  assert.equal(extractPhoneFromIdentity("sip_+919876543210"), "+919876543210");
  assert.equal(extractPhoneFromIdentity("caller"), "");
});

test("validatePostCallAnalysis enforces required fields", () => {
  const invalid = validatePostCallAnalysis({ summary: "too short" }, {});
  assert.equal(invalid.valid, false);

  const valid = validatePostCallAnalysis(
    {
      summary:
        "The caller asked about MCA admission and fees. They booked an appointment for tomorrow at 3 PM.",
      primary_intent: "admission_inquiry",
      secondary_intents: ["fee_inquiry", "appointment_booking"],
      outcome: "appointment_booked",
      lead_score: 88,
      sentiment: "positive",
      objections: [],
      collected_information: { name: "Rahul", course_interest: "MCA" },
      appointment_booked: true,
      appointment_date: "tomorrow",
      appointment_time: "3 PM",
      next_action: "counselor follow-up",
    },
    {
      callState: {
        bookingStatus: "completed",
        collectedData: { preferred_date: "tomorrow", preferred_time: "3 PM" },
      },
    },
  );

  assert.equal(valid.valid, true);
  assert.equal(valid.analysis.outcome, "appointment_booked");
  assert.equal(valid.analysis.appointmentBooked, true);
  assert.equal(valid.analysis.leadScore, 88);
});

test("inferOutcomeFromContext maps booking completion", () => {
  assert.equal(
    inferOutcomeFromContext({
      endReason: "appointment_confirmed",
      callState: { bookingStatus: "completed", turnCount: 6 },
    }),
    "appointment_booked",
  );
  assert.equal(
    inferOutcomeFromContext({
      endReason: "user_not_interested",
      callState: { leadStatus: "not_interested", turnCount: 3 },
    }),
    "not_interested",
  );
});

test("buildRuleBasedAnalysis produces dashboard-ready fields", () => {
  const analysis = buildRuleBasedAnalysis({
    endReason: "appointment_confirmed",
    callState: {
      leadStatus: "qualified",
      turnCount: 5,
      bookingStatus: "completed",
      userIntent: { intent: "appointment_booking" },
      collectedData: {
        name: "Rahul",
        preferred_date: "tomorrow",
        preferred_time: "3 PM",
        course_interest: "MCA",
      },
    },
  });

  assert.equal(analysis.outcome, "appointment_booked");
  assert.equal(analysis.appointmentBooked, true);
  assert.ok(analysis.summary.includes("appointment"));
  assert.ok(analysis.leadScore >= 80);
  assert.ok(analysis.nextAction.length > 0);
});
