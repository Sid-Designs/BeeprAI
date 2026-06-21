import test from "node:test";
import assert from "node:assert/strict";
import { buildCallLearningSnapshot } from "../services/conversationLearning.service.js";

test("learning snapshot marks callback conversion strongly", () => {
  const result = buildCallLearningSnapshot({
    objective: "lead_generation",
    stage: "closing",
    leadStatus: "interested",
    collectedData: { course: "MBA", callbackRequested: true },
    summary: "lead_generation stage=closing",
    endReason: "user_requested_callback",
    isClosed: true,
    turnCount: 6,
    lastUserMessage: "Call me tomorrow morning",
    lastAssistantMessage: "Perfect, I noted tomorrow morning.",
    callbackRequested: true,
    callbackSchedule: { text: "tomorrow morning" },
    telemetry: { intentScore: 72, goalDelta: "moved_closer" },
    qualityScore: 82,
  });

  assert.equal(result.outcomeType, "callback_scheduled");
  assert.ok(result.successScore >= 75);
  assert.ok(result.bookingReadiness >= 80);
});

test("learning snapshot flags knowledge gaps for factual misses", () => {
  const result = buildCallLearningSnapshot({
    objective: "lead_generation",
    stage: "discovery",
    leadStatus: "unsure",
    collectedData: {},
    summary: "lead_generation stage=discovery",
    endReason: "",
    isClosed: false,
    turnCount: 9,
    lastUserMessage: "What are the fees?",
    lastAssistantMessage: "I do not have that exact detail right now.",
    callbackRequested: false,
    callbackSchedule: null,
    telemetry: { kbGateTriggered: true, intentScore: 48, stalledTurns: 2 },
    qualityScore: 50,
  });

  assert.equal(result.outcomeType, "knowledge_gap");
  assert.ok(result.improvementTags.includes("knowledge_gap"));
  assert.match(result.coachingSuggestion, /expand knowledge coverage/i);
});

test("learning snapshot captures appointment requests", () => {
  const result = buildCallLearningSnapshot({
    objective: "custom",
    stage: "appointment",
    leadStatus: "interested",
    collectedData: {
      appointmentRequested: true,
      appointmentSchedule: { text: "tomorrow morning", timeline: "tomorrow", preferredTime: "morning" },
    },
    summary: "custom stage=appointment",
    endReason: "",
    isClosed: false,
    turnCount: 2,
    lastUserMessage: "Can you book appointment for tomorrow morning?",
    lastAssistantMessage: "Perfect, I noted your appointment request.",
    callbackRequested: false,
    callbackSchedule: null,
    telemetry: { appointmentRequested: true, intentScore: 75 },
    qualityScore: 80,
  });

  assert.equal(result.outcomeType, "appointment_ready");
  assert.ok(result.successScore >= 80);
});
