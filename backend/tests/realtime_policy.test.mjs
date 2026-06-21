import test from "node:test";
import assert from "node:assert/strict";
import {
  computeGoalDelta,
  detectConversationSignals,
  getEndCallDecision,
  shouldEndAfterRepeatedThanks,
} from "../services/callPolicy.service.js";
import { validateResponse } from "../services/conversation/responseValidator.service.js";
import { buildObjectionPlaybookReply } from "../services/guidanceEngine.service.js";
import {
  buildRealtimeSessionInstructions,
  buildRealtimeTurnInstruction,
} from "../services/realtime/realtimeIntelligence.service.js";

test("intent completed without user consent should not end call", () => {
  const signals = detectConversationSignals("thanks");
  const decision = getEndCallDecision({ signals, leadStatus: "qualified", stage: "closing" });
  assert.equal(decision.endCall, false);
});

test("explicit hard-close should end call", () => {
  const signals = detectConversationSignals("please end the call now");
  const decision = getEndCallDecision({ signals, leadStatus: "interested", stage: "discovery" });
  assert.equal(decision.endCall, true);
  assert.equal(decision.reason, "user_requested_end");
});

test("off-topic signal should be detected for redirect handling", () => {
  const signals = detectConversationSignals("how is the weather today?");
  assert.equal(signals.offTopic, true);
});

test("weak closing signal should request confirmation instead of ending", () => {
  const signals = detectConversationSignals("bye friend");
  assert.equal(signals.hardClose, false);
  assert.equal(signals.closeConsent, false);
  assert.equal(signals.shouldConfirmClose, true);
});

test("strong goodbye should count as clear close consent", () => {
  const signals = detectConversationSignals("goodbye.");
  assert.equal(signals.closeConsent, true);
  assert.equal(signals.shouldConfirmClose, false);
});

test("validator replaces unsupported factual claims without knowledge", () => {
  const result = validateResponse({
    query: "What are the fees?",
    answer: "The fees are ₹5 lakh per year.",
    knowledge: "",
  });
  assert.equal(result.valid, false);
  assert.match(result.answer, /do not have that exact detail right now/i);
});

test("validator redirects irrelevant answers", () => {
  const result = validateResponse({
    query: "What are the fees?",
    answer: "B.Com is a three year course.",
    knowledge: "Fees details are unavailable.",
  });
  assert.equal(result.valid, false);
  assert.match(result.answer, /fee|admission|eligibility/i);
});

test("repeated thanks after close confirmation should end call", () => {
  const shouldEnd = shouldEndAfterRepeatedThanks({
    closeConfirmAsked: true,
    gratitudeClose: true,
    thanksCount: 1,
  });
  assert.equal(shouldEnd, true);
});

test("realtime instructions preserve consent-based closing policy without voice profile", () => {
  const instruction = buildRealtimeSessionInstructions({
    baseInstruction:
      "Consent-based closing: End only on clear consent.",
    memorySummary: "",
    compactSummary: "",
    intentState: { primaryIntent: "help with admissions", status: "in_progress" },
  });

  assert.doesNotMatch(instruction, /voice profile|pace=|pitch=|pause_style/i);
  assert.match(instruction, /consent-based closing/i);
  assert.match(instruction, /active primary intent/i);
});

test("turn instruction includes KB-safe and no-hallucination behavior", () => {
  const turnInstruction = buildRealtimeTurnInstruction({
    primaryIntent: "collect admission interest",
    intentStatus: "in_progress",
  });
  assert.match(turnInstruction, /Use only knowledge base/i);
  assert.match(turnInstruction, /Never end only because user says thanks once/i);
});

test("goal delta marks off-topic as off_track", () => {
  const delta = computeGoalDelta({
    previousLeadStatus: "interested",
    currentLeadStatus: "interested",
    offTopic: true,
  });
  assert.equal(delta, "off_track");
});

test("goal delta marks lead progression as moved_closer", () => {
  const delta = computeGoalDelta({
    previousLeadStatus: "new",
    currentLeadStatus: "qualified",
    offTopic: false,
  });
  assert.equal(delta, "moved_closer");
});

test("objection playbook varies by seed", () => {
  const a = buildObjectionPlaybookReply({ objection: "price", language: "en", variantSeed: 0 });
  const b = buildObjectionPlaybookReply({ objection: "price", language: "en", variantSeed: 1 });
  assert.notEqual(a, b);
});
