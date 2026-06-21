import test from "node:test";
import assert from "node:assert/strict";
import {
  isSchedulingOrBookingRequest,
  isCounselorConnectRequest,
} from "../services/conversation/conversationPlaybook.service.js";
import { detectUserIntent } from "../services/conversation/userIntent.service.js";
import { extractLeadData, sanitizePersonName } from "../services/conversation/dataExtraction.service.js";
import { validateResponse } from "../services/conversation/responseValidator.service.js";
import { detectClosureSignals } from "../services/conversation/callClosure.service.js";
import { buildConversationDirective } from "../services/conversation/conversationDirector.service.js";
import { applyConversationStyle } from "../services/conversationStyle.service.js";
import { extractIndicDateTime } from "../services/conversation/indicDateTime.service.js";

test("isSchedulingOrBookingRequest matches counselor scheduling phrases", () => {
  assert.equal(isSchedulingOrBookingRequest("Scheduling a counselor call"), true);
  assert.equal(isSchedulingOrBookingRequest("scheduling a counselor call"), true);
  assert.equal(isSchedulingOrBookingRequest("I want to book an appointment"), true);
  assert.equal(isSchedulingOrBookingRequest("tell me about fees"), false);
});

test("detectUserIntent resolves scheduling counselor call", () => {
  const intent = detectUserIntent({
    query: "Scheduling a counselor call",
    collectedData: extractLeadData("Scheduling a counselor call"),
    turnCount: 2,
  });
  assert.equal(intent.intent, "appointment_booking");
  assert.ok(intent.confidence >= 0.85);
});

test("validator preserves booking confirmation with time mentions", () => {
  const result = validateResponse({
    answer: "Perfect. I noted your appointment request for tomorrow around 2 PM. Shall I confirm this booking?",
    query: "can you book appointment for tomorrow around 2 PM",
    stage: "appointment_booking",
    trustedTemplate: true,
  });
  assert.match(result.answer, /2 PM|tomorrow/i);
  assert.equal(result.valid, true);
});

test("validator uses contextual fallback for short acknowledgements", () => {
  const result = validateResponse({
    answer: "Let me continue with the next step in our conversation flow.",
    query: "Yes",
    stage: "qualification",
  });
  assert.doesNotMatch(result.answer, /keep this simple/i);
});

test("validator uses admission fallback for admission queries", () => {
  const result = validateResponse({
    answer: "Let me continue with the next step in our conversation flow.",
    query: "I am looking for admission process",
    stage: "qualification",
  });
  assert.match(result.answer, /admission|eligibility|fees/i);
});

test("counselor connect request is detected", () => {
  assert.equal(isCounselorConnectRequest("I want to talk with counselor"), true);
  assert.equal(isSchedulingOrBookingRequest("I want to talk with counselor"), true);
});

test("counselor request routes to booking not close", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation", allowAppointmentBooking: true },
    state: {
      stage: "qualification",
      greeted: true,
      turnCount: 2,
      intentStatus: "resolved",
      leadStatus: "qualified",
    },
    userIntent: { intent: "appointment_booking", confidence: 0.92 },
    signals: {},
    query: "I want to talk with counselor",
    extractedData: { appointmentRequested: true },
  });
  assert.equal(directive.action, "appointment_booking");
});

test("closure is blocked while user asks for counselor", () => {
  const closure = detectClosureSignals({
    query: "I want to talk with counselor",
    signals: {},
    state: { stage: "qualification", leadStatus: "qualified", closeOffered: false },
  });
  assert.equal(closure.shouldClose, false);
  assert.equal(closure.shouldOfferClose, false);
});

test("soft close offer does not append goodbye", () => {
  const styled = applyConversationStyle({
    answer: "Is there anything else I can help you with before we close?",
    stage: "closing",
    turnCount: 2,
  });
  assert.doesNotMatch(styled, /goodbye/i);
});

test("counseling apartment STT maps to booking intent", () => {
  assert.equal(isCounselorConnectRequest("Can we go to the counseling apartment"), true);
  assert.equal(isSchedulingOrBookingRequest("Can we go to the counseling apartment"), true);
});

test("sanitizePersonName strips trailing yes", () => {
  assert.equal(sanitizePersonName("Sudesh Yes"), "Sudesh");
});

test("marathi arrange with kal routes to booking", () => {
  const indic = extractIndicDateTime("ठीक आहे, काल से पण अरेंज करा");
  assert.equal(indic.preferred_date, "tomorrow");
  assert.equal(indic.appointmentRequested, true);
  assert.equal(isSchedulingOrBookingRequest("ठीक आहे, काल से पण अरेंज करा"), true);
});

test("probing affirmation advances to appointment booking", () => {
  const directive = buildConversationDirective({
    policy: { objective: "lead_generation", allowAppointmentBooking: true },
    state: {
      stage: "booking_readiness",
      greeted: true,
      turnCount: 6,
      intentStatus: "resolved",
      bookingReadiness: "probing",
      returnStage: "qualification",
    },
    userIntent: { intent: "admission_inquiry", confidence: 0.9 },
    signals: {},
    query: "ठीक आहे. हा.",
    extractedData: {},
  });
  assert.equal(directive.action, "appointment_booking");
});
