import test from "node:test";
import assert from "node:assert/strict";
import {
  detectUserIntent,
  shouldUseLlmIntentFallback,
  resolveUserIntentAsync,
  INTENT_CONFIDENCE_THRESHOLD,
} from "../services/conversation/userIntent.service.js";
import { classifyUserIntentWithLlm } from "../services/llm.service.js";

const PARAPHRASE_QUERY =
  "thinking about joining you folks next cycle — what would I owe yearly";

test("detectUserIntent stays low confidence on paraphrased fee question", () => {
  const intent = detectUserIntent({
    query: PARAPHRASE_QUERY,
    turnCount: 1,
  });
  assert.ok(intent.confidence < INTENT_CONFIDENCE_THRESHOLD);
});

test("shouldUseLlmIntentFallback gates on confidence and cached LLM intent", () => {
  const low = detectUserIntent({
    query: PARAPHRASE_QUERY,
    turnCount: 1,
  });
  assert.equal(
    shouldUseLlmIntentFallback(low, null, { enableLlmFallback: true }),
    true,
  );
  assert.equal(
    shouldUseLlmIntentFallback(low, null, { enableLlmFallback: false }),
    false,
  );

  const cached = {
    intent: "fee_inquiry",
    confidence: 0.9,
    subTopics: [],
    source: "llm",
  };
  assert.equal(shouldUseLlmIntentFallback(low, cached), false);
});

test("resolveUserIntentAsync upgrades paraphrase via injected classifier", async () => {
  const result = await resolveUserIntentAsync(
    {
      query: PARAPHRASE_QUERY,
      turnCount: 1,
    },
    {
      enableLlmFallback: true,
      classifyFn: async () => ({
        intent: "fee_inquiry",
        confidence: 0.88,
        subTopics: ["fees"],
      }),
    },
  );

  assert.equal(result.intent, "fee_inquiry");
  assert.ok(result.confidence >= INTENT_CONFIDENCE_THRESHOLD);
  assert.equal(result.source, "llm");
});

test("resolveUserIntentAsync reuses cached LLM intent on vague follow-up", async () => {
  let calls = 0;
  const result = await resolveUserIntentAsync(
    {
      query: "yes",
      turnCount: 3,
      previousIntent: {
        intent: "admission_inquiry",
        confidence: 0.9,
        subTopics: ["MCA"],
        source: "llm",
      },
    },
    {
      enableLlmFallback: true,
      classifyFn: async () => {
        calls += 1;
        return { intent: "information_request", confidence: 0.8, subTopics: [] };
      },
    },
  );

  assert.equal(calls, 0);
  assert.equal(result.intent, "admission_inquiry");
  assert.equal(result.source, "llm");
});

test("resolveUserIntentAsync keeps regex result when classifier fails", async () => {
  const result = await resolveUserIntentAsync(
    {
      query: PARAPHRASE_QUERY,
      turnCount: 1,
    },
    {
      enableLlmFallback: true,
      classifyFn: async () => null,
    },
  );

  const regexOnly = detectUserIntent({
    query: PARAPHRASE_QUERY,
    turnCount: 1,
  });
  assert.equal(result.intent, regexOnly.intent);
  assert.equal(result.confidence, regexOnly.confidence);
});

test("classifyUserIntentWithLlm returns null without API key", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    const result = await classifyUserIntentWithLlm({
      query: "I want to know the tuition for MCA",
    });
    assert.equal(result, null);
  } finally {
    if (previousKey) process.env.GROQ_API_KEY = previousKey;
  }
});
