import test from "node:test";
import assert from "node:assert/strict";
import { detectRecoveryNeed } from "../services/conversation/recoveryPolicy.service.js";
import { validateResponseCompliance } from "../services/compliance/responseCompliance.service.js";
import { shapeVoiceFriendlyText } from "../services/realtime/voiceRealism.service.js";

test("recovery policy catches unclear user message", () => {
  const result = detectRecoveryNeed({ query: "sorry, can you repeat?" });
  assert.equal(result.recoveryType, "asr_or_clarity");
  assert.match(result.suggestedReply, /repeat|clearly/i);
});

test("recovery policy catches contradiction in course", () => {
  const result = detectRecoveryNeed({
    query: "I want MBA now",
    state: { collectedData: { course: "BCA" } },
    currentIntent: "admission",
  });
  assert.equal(result.recoveryType, "contradiction");
});

test("compliance guard blocks unbacked numeric claim", () => {
  const result = validateResponseCompliance({
    query: "What is the fee?",
    answer: "The fee is 25000 and registration is 999.",
    knowledge: "Admission support is available. Contact team for current fee details.",
  });
  assert.equal(result.compliant, false);
  assert.match(result.safeAnswer, /verified detail|confirmed process/i);
});

test("compliance guard allows grounded factual answer", () => {
  const result = validateResponseCompliance({
    query: "What is the fee?",
    answer: "The fee is 25000 with admission support.",
    knowledge: "Current fee is 25000 with admission support.",
  });
  assert.equal(result.compliant, true);
});

test("voice realism layer adds natural contractions", () => {
  const value = shapeVoiceFriendlyText("I am here and I will help");
  assert.match(value, /I'm here/i);
  assert.match(value, /I'll help/i);
});

