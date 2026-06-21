import test from "node:test";
import assert from "node:assert/strict";
import { finalizeOutboundAnswerAsync } from "../services/conversation/finalizeOutboundAnswer.service.js";
import { regenerateCompliantVoiceAnswer } from "../services/llm.service.js";

const blockedParams = {
  answer: "The annual fee is exactly 999999 per year.",
  query: "What are the MCA fees?",
  knowledge: "",
  stage: "query_resolution",
  enableCompliance: true,
  enableVoiceRealism: false,
};

test("finalizeOutboundAnswerAsync falls back to safeAnswer without regenerator", async () => {
  const result = await finalizeOutboundAnswerAsync(blockedParams);
  assert.equal(result.compliance.compliant, false);
  assert.equal(result.complianceRecovered, false);
  assert.match(result.answer, /do not have that exact verified detail/i);
});

test("finalizeOutboundAnswerAsync recovers when regeneration passes compliance", async () => {
  const result = await finalizeOutboundAnswerAsync({
    ...blockedParams,
    knowledge: "Current MCA fee is 1.2 lakh per year with admission support.",
    regenerateAnswer: async () => "The current MCA fee is 1.2 lakh per year with admission support.",
  });
  assert.equal(result.complianceRetried, true);
  assert.equal(result.complianceRecovered, true);
  assert.match(result.answer, /1\.2 lakh/i);
});

test("finalizeOutboundAnswerAsync uses safeAnswer when retry still fails", async () => {
  const result = await finalizeOutboundAnswerAsync({
    ...blockedParams,
    regenerateAnswer: async () => "The fee is still 999999 per year.",
  });
  assert.equal(result.complianceRetried, true);
  assert.equal(result.complianceRecovered, false);
  assert.match(result.answer, /do not have that exact verified detail/i);
});

test("regenerateCompliantVoiceAnswer returns empty without API key", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const answer = await regenerateCompliantVoiceAnswer({
      query: "What are the MCA fees?",
      knowledge: "Contact admissions for fee details.",
      blockedAnswer: "The fee is 999999.",
      reason: "unbacked_numeric_claim",
    });
    assert.equal(answer, "");
  } finally {
    if (previousKey) process.env.GROQ_API_KEY = previousKey;
  }
});
