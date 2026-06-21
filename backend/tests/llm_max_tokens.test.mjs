import test from "node:test";
import assert from "node:assert/strict";
import {
  MODE_LLM_MAX_TOKENS,
  resolveLlmMaxTokens,
} from "../services/llm.service.js";

test("MODE_LLM_MAX_TOKENS maps response style modes", () => {
  assert.equal(MODE_LLM_MAX_TOKENS.concise, 100);
  assert.equal(MODE_LLM_MAX_TOKENS.factual, 150);
  assert.equal(MODE_LLM_MAX_TOKENS.balanced, 200);
  assert.equal(MODE_LLM_MAX_TOKENS.explain, 280);
});

test("resolveLlmMaxTokens uses mode targets when not in fast mode", () => {
  assert.equal(
    resolveLlmMaxTokens({ mode: "concise" }, { voiceFastMode: false, absoluteCeiling: 300 }),
    100,
  );
  assert.equal(
    resolveLlmMaxTokens({ mode: "explain" }, { voiceFastMode: false, absoluteCeiling: 300 }),
    280,
  );
});

test("resolveLlmMaxTokens caps by absolute ceiling", () => {
  assert.equal(
    resolveLlmMaxTokens({ mode: "explain" }, { voiceFastMode: false, absoluteCeiling: 180 }),
    180,
  );
});

test("resolveLlmMaxTokens uses voice fast ceiling without forcing a flat token count", () => {
  assert.equal(
    resolveLlmMaxTokens({ mode: "concise" }, { voiceFastMode: true, voiceFastCeiling: 200 }),
    100,
  );
  assert.equal(
    resolveLlmMaxTokens({ mode: "balanced" }, { voiceFastMode: true, voiceFastCeiling: 200 }),
    200,
  );
  assert.equal(
    resolveLlmMaxTokens({ mode: "explain" }, { voiceFastMode: true, voiceFastCeiling: 200 }),
    200,
  );
});

test("resolveLlmMaxTokens defaults unknown modes to balanced", () => {
  assert.equal(
    resolveLlmMaxTokens({ mode: "default" }, { voiceFastMode: false, absoluteCeiling: 300 }),
    200,
  );
  assert.equal(
    resolveLlmMaxTokens({}, { voiceFastMode: false, absoluteCeiling: 300 }),
    200,
  );
});
