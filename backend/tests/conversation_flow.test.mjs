import test from "node:test";
import assert from "node:assert/strict";
import { buildConversationDirective } from "../services/conversation/conversationDirector.service.js";
import { updateConversationProgress } from "../services/conversation/conversationStage.service.js";
import { shouldTrustApiAnswer } from "../services/conversation/callStateSync.service.js";

test("director routes appointment request before callback", () => {
  const directive = buildConversationDirective({
    policy: { objective: "appointment_booking" },
    state: {
      stage: "qualification",
      intentStatus: "resolved",
      greeted: true,
      turnCount: 3,
      collectedData: {},
    },
    userIntent: { intent: "callback_request", confidence: 0.9 },
    signals: { callbackIntent: true },
    query: "Book appointment for tomorrow at 2 PM",
    extractedData: { appointmentRequested: true, preferred_date: "tomorrow", preferred_time: "2 pm" },
  });

  assert.equal(directive.action, "appointment_booking");
  assert.equal(directive.skipLLM, true);
});

test("director steers toward booking after stalled turns instead of closing early", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation" },
    state: {
      stage: "qualification",
      intentStatus: "resolved",
      greeted: true,
      turnCount: 4,
      goalTracker: { stalledTurns: 3 },
      collectedData: { course: "MCA" },
    },
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    signals: {},
    query: "okay",
  });

  assert.equal(directive.action, "probe_booking_readiness");
  assert.notEqual(directive.action, "offer_close");
});

test("director reopens menu when user says yes after close offer", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation" },
    state: {
      stage: "qualification",
      intentStatus: "resolved",
      greeted: true,
      turnCount: 6,
      closeOffered: true,
      collectedData: {},
    },
    userIntent: { intent: "unknown", confidence: 0.2 },
    signals: {},
    query: "Yes",
  });

  assert.equal(directive.action, "intent_menu");
  assert.equal(directive.closeOffered, false);
});

test("updateConversationProgress marks stalled llm turns", () => {
  const progress = updateConversationProgress({
    previousState: {
      stage: "qualification",
      collectedData: { course: "MCA" },
      lastAssistantPrompt: "What else would you like to know?",
    },
    nextStage: "qualification",
    collectedData: { course: "MCA" },
    directiveAction: "llm_turn",
  });

  assert.equal(progress.goalTracker.lastDelta, "stalled");
  assert.ok(progress.goalTracker.stalledTurns >= 1);
});

test("shouldTrustApiAnswer respects intent director responses", () => {
  assert.equal(shouldTrustApiAnswer({ directiveAction: "appointment_booking" }), true);
  assert.equal(shouldTrustApiAnswer({ answerSource: "intent_director" }), true);
  assert.equal(shouldTrustApiAnswer({ fromMemory: true }), true);
  assert.equal(shouldTrustApiAnswer({ directiveAction: "llm_turn", answerSource: "llm" }), false);
});
