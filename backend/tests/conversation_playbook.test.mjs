import test from "node:test";
import assert from "node:assert/strict";
import {
  detectConversationPlaybook,
  PLAYBOOK_OUTCOMES,
  buildPlaybookSteerLine,
  buildAppointmentConfirmReply,
  buildAppointmentNotFoundReply,
} from "../services/conversation/conversationPlaybook.service.js";
import { buildConversationDirective } from "../services/conversation/conversationDirector.service.js";
import { composeQueryResolutionResponse } from "../services/conversation/queryResolution.service.js";

const basePolicy = { objective: "lead_generation", allowAppointmentBooking: true };

test("Pattern A: information seeking routes to answer_then_steer", () => {
  const playbook = detectConversationPlaybook({
    query: "What are MCA fees?",
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    collectedData: {},
    state: { stage: "qualification" },
  });
  assert.equal(playbook.id, "information_seeking");
  assert.equal(playbook.outcome, PLAYBOOK_OUTCOMES.information_provided);
  assert.equal(playbook.priority, "answer");

  const directive = buildConversationDirective({
    policy: basePolicy,
    state: { stage: "qualification", greeted: true, turnCount: 2, intentStatus: "resolved" },
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    signals: {},
    query: "What are MCA fees?",
    extractedData: {},
  });
  assert.equal(directive.action, "answer_then_steer");
});

test("Pattern B: interested lead answers before booking", () => {
  const directive = buildConversationDirective({
    policy: basePolicy,
    state: {
      stage: "qualification",
      greeted: true,
      turnCount: 2,
      intentStatus: "resolved",
      collectedData: { course: "MCA" },
      bookingReadiness: "not_asked",
    },
    userIntent: { intent: "admission_inquiry", confidence: 0.92 },
    signals: {},
    query: "I want MCA admission information",
    extractedData: { course: "MCA" },
  });
  assert.equal(directive.action, "answer_then_steer");
  assert.notEqual(directive.action, "appointment_booking");
});

test("Pattern C: career question is answer-first", () => {
  const playbook = detectConversationPlaybook({
    query: "What career opportunities are available after MCA?",
    userIntent: { intent: "information_request", confidence: 0.85 },
    collectedData: { course: "MCA" },
    state: { stage: "qualification" },
    intentProfile: { commitmentScore: 60 },
  });
  assert.equal(playbook.priority, "answer");

  const response = composeQueryResolutionResponse({
    kbContext: "MCA graduates work in software development, cloud, and data roles.",
    query: "What career opportunities are available after MCA?",
    userIntent: { intent: "information_request", confidence: 0.85 },
    policy: basePolicy,
    bookingReadiness: "not_asked",
    steerCTA: "qualify_soft",
    turnCount: 3,
  });
  assert.match(response, /software|career|development/i);
  assert.doesNotMatch(response, /book an appointment/i);
});

test("Pattern D: parent inquiry collects student context", () => {
  const playbook = detectConversationPlaybook({
    query: "I am calling for my son about admission",
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    collectedData: {},
    state: { stage: "qualification" },
  });
  assert.equal(playbook.id, "parent_inquiry");
  assert.equal(playbook.steerStyle, "collect_student_info");
});

test("Pattern E: comparing colleges uses differentiators steer", () => {
  const playbook = detectConversationPlaybook({
    query: "I am comparing multiple colleges for MCA",
    userIntent: { intent: "admission_inquiry", confidence: 0.88 },
    collectedData: { course: "MCA" },
    state: { stage: "qualification" },
  });
  assert.equal(playbook.id, "comparing_colleges");
  assert.equal(playbook.outcome, PLAYBOOK_OUTCOMES.follow_up_required);
});

test("Pattern F: objection routes to handle_objection", () => {
  const directive = buildConversationDirective({
    policy: basePolicy,
    state: { stage: "qualification", greeted: true, turnCount: 3, intentStatus: "resolved" },
    userIntent: { intent: "objection", confidence: 0.8 },
    signals: {},
    query: "The fees are too high",
    extractedData: {},
  });
  assert.equal(directive.action, "handle_objection");
  assert.equal(directive.expectedOutcome, PLAYBOOK_OUTCOMES.objection_handled);
});

test("Pattern G: confirm appointment with memory does not restart booking", () => {
  const directive = buildConversationDirective({
    policy: basePolicy,
    state: {
      stage: "confirmation",
      greeted: true,
      turnCount: 5,
      intentStatus: "resolved",
      collectedData: {
        preferred_date: "tomorrow",
        preferred_time: "2 pm",
        appointmentRequested: true,
      },
    },
    userIntent: { intent: "appointment_booking", confidence: 0.9 },
    signals: {},
    query: "Can you confirm my appointment?",
    extractedData: {},
  });
  assert.equal(directive.action, "confirm_appointment");

  const reply = buildAppointmentConfirmReply({
    collectedData: { preferred_date: "tomorrow", preferred_time: "2 pm", name: "Rahul" },
  });
  assert.match(reply, /tomorrow/i);
  assert.match(reply, /2 pm/i);
  assert.doesNotMatch(reply, /what date and time/i);
});

test("Pattern G: confirm without appointment offers schedule softly", () => {
  const directive = buildConversationDirective({
    policy: basePolicy,
    state: { stage: "qualification", greeted: true, turnCount: 4, intentStatus: "resolved" },
    userIntent: { intent: "information_request", confidence: 0.7 },
    signals: {},
    query: "Can you confirm my appointment?",
    extractedData: {},
  });
  assert.equal(directive.action, "appointment_not_found");
  assert.match(buildAppointmentNotFoundReply(), /don't see a confirmed appointment/i);
});

test("Pattern H: follow-up continues prior context", () => {
  const playbook = detectConversationPlaybook({
    query: "I spoke with someone yesterday about MCA",
    userIntent: { intent: "admission_inquiry", confidence: 0.85 },
    collectedData: { course: "MCA" },
    state: { stage: "qualification" },
  });
  assert.equal(playbook.id, "existing_lead_followup");
  assert.equal(playbook.outcome, PLAYBOOK_OUTCOMES.lead_continued);
});

test("eligibility question skips intent discovery", () => {
  const directive = buildConversationDirective({
    policy: basePolicy,
    state: {
      stage: "intent_discovery",
      greeted: true,
      turnCount: 2,
      intentStatus: "pending",
      collectedData: { course: "MCA" },
    },
    userIntent: { intent: "admission_inquiry", confidence: 0.94 },
    signals: {},
    query: "Can you tell me the eligibility criteria?",
    extractedData: { course: "MCA" },
  });
  assert.equal(directive.action, "answer_then_steer");
  assert.notEqual(directive.action, "intent_discovery_reply");
});

test("playbook steer lines avoid repetitive booking CTAs", () => {
  const a = buildPlaybookSteerLine({ steerStyle: "optional_followup", variantSeed: 0 });
  const b = buildPlaybookSteerLine({ steerStyle: "optional_followup", variantSeed: 1 });
  assert.doesNotMatch(a, /book an appointment/i);
  assert.notEqual(a, b);
});

test("scheduling a counselor call routes to appointment booking", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation", allowAppointmentBooking: true },
    state: { stage: "intent_discovery", greeted: true, turnCount: 2, intentStatus: "pending" },
    userIntent: { intent: "appointment_booking", confidence: 0.92 },
    signals: {},
    query: "Scheduling a counselor call",
    extractedData: { appointmentRequested: true },
  });
  assert.equal(directive.action, "appointment_booking");
  assert.equal(directive.stage, "appointment_booking");
});

test("STT scheduling-of-request normalizes to booking intent", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation", allowAppointmentBooking: true },
    state: { stage: "intent_discovery", greeted: true, turnCount: 3, intentStatus: "pending" },
    userIntent: { intent: "appointment_booking", confidence: 0.92 },
    signals: {},
    query: "scheduling a counselor call",
    extractedData: { appointmentRequested: true },
  });
  assert.equal(directive.action, "appointment_booking");
});
