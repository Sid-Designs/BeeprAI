import test from "node:test";
import assert from "node:assert/strict";
import { formatCallInsights } from "../services/insights/callInsightFormatter.service.js";

test("formatCallInsights maps KB gaps and declined customers", () => {
  const insights = formatCallInsights({
    analysisStatus: "completed",
    outcome: "not_interested",
    endReason: "user_not_interested",
    metadata: {
      analytics: { kbGateTriggered: true, stalledTurns: 1 },
    },
  });

  assert.ok(insights.includes("Agent didn't have verified info for this question"));
  assert.ok(insights.includes("Customer declined"));
  assert.equal(insights.length, 2);
});

test("formatCallInsights describes callback and stalled conversations", () => {
  const insights = formatCallInsights({
    analysisStatus: "completed",
    outcome: "callback_scheduled",
    endReason: "user_requested_callback",
    appointmentDate: "tomorrow",
    appointmentTime: "10 AM",
    metadata: {
      analytics: { stalledTurns: 4 },
    },
  });

  assert.ok(insights.includes("Callback requested at tomorrow at 10 AM"));
  assert.ok(insights.includes("Conversation looped without progress"));
});

test("formatCallInsights handles failed analysis and appointment booking", () => {
  const failed = formatCallInsights({
    analysisStatus: "failed",
    outcome: "unknown",
    metadata: {},
  });
  assert.deepEqual(failed, ["Report generation failed — partial data shown"]);

  const booked = formatCallInsights({
    analysisStatus: "completed",
    outcome: "appointment_booked",
    appointmentBooked: true,
    appointmentDate: "12 June",
    appointmentTime: "3 PM",
    metadata: { analytics: {} },
  });
  assert.ok(booked.includes("Appointment booked for 12 June at 3 PM"));
});

test("formatCallInsights includes customer objections and caps at five bullets", () => {
  const insights = formatCallInsights({
    analysisStatus: "completed",
    outcome: "qualified_lead",
    objections: ["fees too high", "needs time to decide", "far from campus"],
    metadata: {
      analytics: { kbGateTriggered: true, stalledTurns: 3 },
    },
  });

  assert.ok(insights.some((item) => item.startsWith("Customer raised: fees too high")));
  assert.ok(insights.some((item) => item.startsWith("Customer raised: needs time to decide")));
  assert.equal(insights.length, 5);
});

test("formatCallInsights falls back to an information-provided message", () => {
  const insights = formatCallInsights({
    analysisStatus: "completed",
    outcome: "information_provided",
    metadata: { analytics: {} },
  });

  assert.deepEqual(insights, ["Customer received the information they asked for"]);
});
