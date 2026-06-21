import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInterruptionContextToState,
  applyInterruptionResumePrefix,
  buildInterruptionResumeMeta,
  buildInterruptionResumePromptBlock,
  clearInterruptionFields,
  deriveActiveTopic,
  isMidExplanationInterrupt,
} from "../services/conversation/interruptionResume.service.js";
import { buildConversationDirective } from "../services/conversation/conversationDirector.service.js";
import { getInitialConversationState } from "../services/callPolicy.service.js";

const longExplanation =
  "MCA admission usually needs a recognized bachelor's degree with minimum fifty percent marks and valid entrance exam scores before document verification and counseling rounds begin for the upcoming academic batch.";

test("isMidExplanationInterrupt requires enough spoken words", () => {
  assert.equal(isMidExplanationInterrupt("Sure, noted."), false);
  assert.equal(isMidExplanationInterrupt(longExplanation), true);
});

test("deriveActiveTopic prefers subTopics and intent", () => {
  assert.equal(
    deriveActiveTopic({ userIntent: { intent: "fee_inquiry", subTopics: ["MCA"] } }),
    "mca",
  );
  assert.equal(deriveActiveTopic({ userIntent: { intent: "admission_inquiry" } }), "admission");
});

test("applyInterruptionContextToState stores pending interruption", () => {
  const state = applyInterruptionContextToState(getInitialConversationState(), {
    interruptedUtterance: longExplanation,
    activeTopic: "fees",
  });
  assert.equal(state.interruptionPending, true);
  assert.equal(state.activeTopic, "fees");
});

test("applyInterruptionResumePrefix only prefixes mid-explanation replies", () => {
  const prefixed = applyInterruptionResumePrefix("The annual fee depends on the course.", {
    midExplanation: true,
  });
  assert.match(prefixed, /^Sure — as I was saying,/);

  const short = applyInterruptionResumePrefix("The annual fee depends on the course.", {
    midExplanation: false,
  });
  assert.equal(short, "The annual fee depends on the course.");
});

test("buildInterruptionResumeMeta and clearInterruptionFields round-trip", () => {
  const meta = buildInterruptionResumeMeta({
    interruptionPending: true,
    interruptedUtterance: longExplanation,
    activeTopic: "fees",
  });
  assert.ok(meta?.midExplanation);
  assert.equal(clearInterruptionFields({ interruptionPending: true }).interruptionPending, false);
});

test("buildInterruptionResumePromptBlock includes cut-off context", () => {
  const block = buildInterruptionResumePromptBlock({
    interruptedUtterance: longExplanation,
    activeTopic: "fees",
    userQuery: "wait what about hostel cost",
  });
  assert.match(block, /INTERRUPTION RESUME/i);
  assert.match(block, /hostel cost/i);
});

test("director emits recover_after_interruption when interruption pending", () => {
  const policy = { objective: "lead_generation" };
  const directive = buildConversationDirective({
    policy,
    state: {
      ...getInitialConversationState(policy),
      intentStatus: "resolved",
      greeted: true,
      turnCount: 4,
      interruptionPending: true,
      interruptedUtterance: longExplanation,
      activeTopic: "fees",
      userIntent: { intent: "fee_inquiry", confidence: 0.9, subTopics: ["fees"] },
    },
    userIntent: { intent: "fee_inquiry", confidence: 0.9, subTopics: ["fees"] },
    signals: {},
    query: "sorry what about hostel fees",
    extractedData: {},
    intentProfile: { commitmentScore: 40 },
  });

  assert.ok(directive.interruptionResume?.midExplanation);
  assert.ok(
    ["answer_then_steer", "recover_after_interruption", "intent_discovery_reply"].includes(
      directive.action,
    ),
  );
});
