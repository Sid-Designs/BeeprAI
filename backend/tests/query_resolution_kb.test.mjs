import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQueryResolutionAnswer,
  composeQueryResolutionResponse,
  mergeAnswerWithSteering,
  shouldUseKbLlmAnswer,
} from "../services/conversation/queryResolution.service.js";

const basePolicy = { objective: "lead_generation", orgName: "Beepr College" };

test("shouldUseKbLlmAnswer requires confidence gate and KB context", () => {
  assert.equal(shouldUseKbLlmAnswer(0.8, "MCA fees are 1.2 lakh per year."), true);
  assert.equal(shouldUseKbLlmAnswer(0.4, "MCA fees are 1.2 lakh per year."), false);
  assert.equal(shouldUseKbLlmAnswer(0.8, ""), false);
});

test("mergeAnswerWithSteering appends CTA unless answer already asks a question", () => {
  const merged = mergeAnswerWithSteering(
    "MCA fees are around 1.2 lakh per year.",
    "Would you like admission dates as well?",
  );
  assert.match(merged, /1\.2 lakh/i);
  assert.match(merged, /admission dates/i);

  const questionOnly = mergeAnswerWithSteering(
    "Are you looking at this year's intake?",
    "Would you like admission dates as well?",
  );
  assert.equal(questionOnly, "Are you looking at this year's intake?");
});

test("composeQueryResolutionResponse keeps template fallback for factual KB answers", () => {
  const response = composeQueryResolutionResponse({
    kbContext: "MCA fees are approximately 1.2 lakh per year.",
    query: "What are the MCA fees?",
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    policy: basePolicy,
    bookingReadiness: "probing",
    retrievalConfidence: 0.2,
  });
  assert.match(response, /1\.2 lakh|1 lakh/i);
});

test("buildQueryResolutionAnswer falls back when KB sentence is missing", () => {
  const response = buildQueryResolutionAnswer({
    kbContext: "",
    query: "What are the MCA fees?",
    userIntent: { intent: "fee_inquiry", confidence: 0.9 },
    policy: basePolicy,
    language: "en",
  });
  assert.match(response, /exact fee detail/i);
});
