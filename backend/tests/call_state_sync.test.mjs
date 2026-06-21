import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldTrustApiAnswer,
  shouldApplyWorkerAnswerRecovery,
  TRUSTED_ANSWER_SOURCES,
} from "../services/conversation/callStateSync.service.js";

test("TRUSTED_ANSWER_SOURCES includes director and memory markers", () => {
  assert.ok(TRUSTED_ANSWER_SOURCES.has("intent_director"));
  assert.ok(TRUSTED_ANSWER_SOURCES.has("memory"));
  assert.ok(TRUSTED_ANSWER_SOURCES.has("llm_kb"));
});

test("shouldTrustApiAnswer trusts intent director and memory responses", () => {
  assert.equal(
    shouldTrustApiAnswer({ answerSource: "intent_director", directiveAction: "answer_then_steer" }),
    true,
  );
  assert.equal(
    shouldTrustApiAnswer({ fromMemory: true, answerSource: "memory" }),
    true,
  );
  assert.equal(
    shouldTrustApiAnswer({ answerSource: "llm_kb", directiveAction: "answer_then_steer" }),
    true,
  );
  assert.equal(
    shouldTrustApiAnswer({ directiveAction: "opening_greeting", answerSource: "template" }),
    true,
  );
});

test("shouldTrustApiAnswer distrusts pure llm_turn answers", () => {
  assert.equal(
    shouldTrustApiAnswer({ directiveAction: "llm_turn", answerSource: "llm" }),
    false,
  );
  assert.equal(shouldApplyWorkerAnswerRecovery({ directiveAction: "llm_turn", answerSource: "llm" }), true);
});

test("shouldTrustApiAnswer trusts finalized kb+llm responses from API", () => {
  assert.equal(
    shouldTrustApiAnswer({ directiveAction: "llm_turn", answerSource: "kb+llm" }),
    true,
  );
  assert.equal(shouldApplyWorkerAnswerRecovery({ directiveAction: "llm_turn", answerSource: "kb+llm" }), false);
});

test("shouldTrustApiAnswer trusts template director actions without answerSource", () => {
  assert.equal(shouldTrustApiAnswer({ directiveAction: "appointment_booking" }), true);
  assert.equal(shouldApplyWorkerAnswerRecovery({ directiveAction: "appointment_booking" }), false);
});
