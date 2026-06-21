import test from "node:test";
import assert from "node:assert/strict";
import { getInitialConversationState } from "../services/callPolicy.service.js";
import {
  detectConversationSignals,
  extractLeadDataFromQuery,
  mergeCollectedData,
  analyzeLeadIntent,
} from "../services/callPolicy.service.js";
import {
  accumulateUserIntent,
  detectUserIntent,
  isIntentResolved,
  INTENT_CONFIDENCE_THRESHOLD,
} from "../services/conversation/userIntent.service.js";
import {
  buildConversationDirective,
  buildIntentDiscoveryReply,
  buildIntentMenuReply,
  buildIntakeConfirmedReply,
} from "../services/conversation/conversationDirector.service.js";
import {
  composeQueryResolutionResponse,
  buildQueryResolutionAnswer,
} from "../services/conversation/queryResolution.service.js";
import {
  evaluateBookingProgress,
  resolveBookingTurn,
} from "../services/conversation/bookingFlow.service.js";
import { buildIntentTelemetry } from "../services/conversation/intentTelemetry.service.js";
import {
  detectClosureSignals,
  buildGracefulCloseReply,
} from "../services/conversation/callClosure.service.js";

const policy = {
  objective: "appointment_booking",
  qualificationFields: ["name", "preferred_date", "preferred_time"],
};

test("detectUserIntent resolves MCA admission on first turn", () => {
  const intent = detectUserIntent({
    query: "I want MCA admission information",
    turnCount: 1,
    collectedData: extractLeadDataFromQuery("I want MCA admission information"),
  });
  assert.equal(intent.intent, "admission_inquiry");
  assert.ok(intent.confidence >= INTENT_CONFIDENCE_THRESHOLD);
  assert.ok(intent.subTopics.includes("MCA"));
});

test("intent discovery reply is targeted, not generic", () => {
  const userIntent = detectUserIntent({
    query: "I want MCA admission information",
    collectedData: { course: "MCA" },
    turnCount: 1,
  });
  const reply = buildIntentDiscoveryReply({
    userIntent,
    collectedData: { course: "MCA" },
    policy,
  });
  assert.match(reply, /MCA/i);
  assert.match(reply, /this year/i);
  assert.doesNotMatch(reply, /how are you/i);
});

test("director moves from discovery to menu after affirmation", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    stage: "intent_discovery",
    userIntent: { intent: "admission_inquiry", confidence: 0.88, subTopics: ["MCA"] },
    turnCount: 2,
  };
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals("Yes"),
    query: "Yes",
    extractedData: {},
    intentProfile: { commitmentScore: 72 },
  });
  assert.equal(directive.action, "intent_menu");
  assert.equal(directive.stage, "qualification");
});

test("query resolution answers and steers toward counselor", () => {
  const response = composeQueryResolutionResponse({
    kbContext: "MCA fees are approximately 1.2 lakh per year.",
    query: "What are the MCA fees?",
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    policy,
    bookingReadiness: "probing",
  });
  assert.match(response, /1\.2 lakh|1 lakh/i);
  assert.match(response, /eligibility|admission dates/i);
});

test("booking flow collects date/time then asks for confirmation", () => {
  let state = {
    ...getInitialConversationState(policy),
    stage: "appointment_booking",
    bookingReadiness: "ready",
    collectedData: { name: "Rahul" },
    turnCount: 3,
  };

  const step = resolveBookingTurn({
    state,
    extractedData: extractLeadDataFromQuery("Tomorrow at 3pm"),
    query: "Tomorrow at 3pm",
    policy,
    intentProfile: analyzeLeadIntent({ query: "Tomorrow at 3pm", signals: {}, collectedData: {} }),
    mergeCollectedDataFn: mergeCollectedData,
  });

  assert.equal(step.stage, "confirmation");
  assert.match(step.answer, /confirm/i);
  assert.equal(step.endCall, false);

  const confirmed = resolveBookingTurn({
    state: step.nextState,
    extractedData: {},
    query: "Tomorrow 11 AM Yeah, confirm that",
    policy,
    intentProfile: {},
    mergeCollectedDataFn: mergeCollectedData,
  });

  assert.equal(confirmed.stage, "completed");
  assert.equal(confirmed.endCall, true);
  assert.match(confirmed.answer, /goodbye/i);
  assert.equal(confirmed.nextState.objectiveAchieved, true);
});

test("booking readiness decline routes back to qualification", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    stage: "booking_readiness",
    bookingReadiness: "probing",
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    turnCount: 4,
  };
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals("No not now"),
    query: "No not now",
    extractedData: {},
    intentProfile: {},
  });
  assert.equal(directive.action, "booking_declined");
  assert.equal(directive.bookingReadiness, "declined");
});

test("intent telemetry exposes resolution metrics", () => {
  const telemetry = buildIntentTelemetry({
    state: {
      userIntent: { intent: "admission_inquiry", confidence: 0.88 },
      intentStatus: "resolved",
      intentResolvedAtTurn: 1,
      intentResolutionMs: 8200,
      bookingReadiness: "probing",
      stage: "intent_discovery",
    },
    turnDirective: { action: "intent_discovery_reply" },
  });
  assert.equal(telemetry.userIntent, "admission_inquiry");
  assert.equal(telemetry.intentResolutionMs, 8200);
  assert.equal(telemetry.directiveAction, "intent_discovery_reply");
});

test("isIntentResolved respects pending vs confirmed status", () => {
  assert.equal(
    isIntentResolved({ intent: "admission_inquiry", confidence: 0.9 }, "pending"),
    true,
  );
  assert.equal(isIntentResolved({ intent: "unknown", confidence: 0.2 }, "pending"), false);
});

test("intent menu offers focused options", () => {
  const reply = buildIntentMenuReply({
    collectedData: { course: "MCA" },
    userIntent: { intent: "admission_inquiry", subTopics: ["MCA"] },
  });
  assert.match(reply, /eligibility, fees, and admission steps/i);
  assert.match(reply, /MCA/i);
});

test("evaluateBookingProgress finds next missing slot", () => {
  const progress = evaluateBookingProgress({
    collectedData: { name: "Rahul", preferred_date: "tomorrow" },
    extractedData: {},
    query: "",
    policy,
  });
  assert.equal(progress.nextSlot, "preferred_time");
  assert.equal(progress.allRequiredFilled, false);
});

test("info-only caller can close after declining counselor", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    bookingReadiness: "declined",
    objectiveAchieved: false,
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    turnCount: 5,
  };
  const closure = detectClosureSignals({
    query: "That's all, thank you",
    signals: detectConversationSignals("That's all, thank you"),
    state,
  });
  assert.equal(closure.shouldClose, true);
  assert.equal(closure.reason, "info_resolved_goodbye");

  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals("That's all, thank you"),
    query: "That's all, thank you",
    extractedData: {},
    intentProfile: {},
  });
  assert.equal(directive.action, "graceful_close");
  assert.equal(directive.endCall, true);
  assert.match(buildGracefulCloseReply({ reason: closure.reason }), /goodbye/i);
});

test("closeOffered with scheduling request and no thanks declines booking instead of closing", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    closeOffered: true,
    bookingReadiness: "not_asked",
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    turnCount: 7,
  };
  const query = "Arrange the counselor form No thanks";
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals(query),
    query,
    extractedData: {},
    intentProfile: {},
  });
  assert.equal(directive.action, "booking_declined");
  assert.equal(directive.closeOffered, false);

  const closure = detectClosureSignals({
    query,
    signals: detectConversationSignals(query),
    state,
  });
  assert.equal(closure.shouldClose, false);
});

test("topic discussion routes to KB answer not counselor escalation", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    stage: "qualification",
    bookingReadiness: "not_asked",
    userIntent: { intent: "admission_inquiry", confidence: 0.85 },
    turnCount: 4,
    goalTracker: { stalledTurns: 3, lastDelta: "stalled" },
  };
  const query = "So talking to you about animation";
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals(query),
    query,
    extractedData: {},
    intentProfile: { commitmentScore: 60 },
  });
  assert.equal(directive.action, "answer_then_steer");
  assert.notEqual(directive.action, "probe_booking_readiness");
});

test("closeOffered with campus visit scheduling starts appointment booking", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    closeOffered: true,
    bookingReadiness: "not_asked",
    userIntent: { intent: "admission_inquiry", confidence: 0.9, subTopics: ["MCA"] },
    turnCount: 6,
  };
  const query =
    "I want to visit in college. Can you schedule an appointment for tomorrow at 10 AM?";
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals(query),
    query,
    extractedData: {},
    intentProfile: {},
  });
  assert.equal(directive.action, "appointment_booking");
  assert.equal(directive.closeOffered, false);
});

test("intake confirmation after yes routes to qualification menu not counselor probe", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    stage: "query_resolution",
    bookingReadiness: "not_asked",
    userIntent: { intent: "admission_inquiry", confidence: 0.9, subTopics: ["MCA"] },
    turnCount: 5,
    lastAssistantPrompt:
      "Admission covers eligibility, application, documents, and counseling. Are you looking at this year's intake?",
    collectedData: { course: "MCA" },
  };
  const directive = buildConversationDirective({
    policy,
    state,
    userIntent: state.userIntent,
    signals: detectConversationSignals("Yes"),
    query: "Yes",
    extractedData: {},
    intentProfile: { commitmentScore: 60 },
  });
  assert.equal(directive.action, "intake_confirmed");
  assert.match(
    buildIntakeConfirmedReply({
      collectedData: state.collectedData,
      userIntent: state.userIntent,
    }),
    /eligibility, fees, or admission steps/i,
  );
});

test("hello thanks alone does not close when close was offered", () => {
  const state = {
    ...getInitialConversationState(policy),
    intentStatus: "resolved",
    closeOffered: true,
    bookingReadiness: "not_asked",
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    turnCount: 7,
  };
  const closure = detectClosureSignals({
    query: "Hello thanks",
    signals: detectConversationSignals("Hello thanks"),
    state,
  });
  assert.equal(closure.shouldClose, false);
});

test("eligibility query gets specific fallback not generic intake loop", () => {
  const answer = buildQueryResolutionAnswer({
    query: "tell me about MCA eligibility",
    userIntent: { intent: "admission_inquiry" },
    kbContext: "",
  });
  assert.match(answer, /MCA|Mathematics|CET/i);
  assert.doesNotMatch(answer, /Are you looking at this year's intake/i);
});
