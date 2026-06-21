import test from "node:test";
import assert from "node:assert/strict";
import {
  polishVoiceResponse,
  stripRoboticPhrasing,
  resolveWordBudget,
  diversifyOpener,
  enforceVoiceFriendly,
  enforceWordCap,
} from "../services/conversation/responsePolish.service.js";
import { applyConversationStyle } from "../services/conversationStyle.service.js";
import { validateResponse } from "../services/conversation/responseValidator.service.js";
import { finalizeOutboundAnswer } from "../services/conversation/finalizeOutboundAnswer.service.js";

test("stripRoboticPhrasing simplifies formal definitions", () => {
  const input =
    "The MCA program is a postgraduate degree program designed for students interested in advanced computer applications.";
  const out = stripRoboticPhrasing(input);
  assert.doesNotMatch(out, /designed for students/i);
});

test("polishVoiceResponse keeps factual answers short", () => {
  const out = polishVoiceResponse({
    answer:
      "Certainly, I can help you with that. The annual MCA fee is approximately 1.2 lakh per year. Furthermore, we also have scholarship options available.",
    query: "What are the MCA fees?",
    turnCount: 3,
    responseStyleProfile: { wordBudget: 22, mode: "factual" },
  });
  assert.match(out, /1\.2 lakh|fee/i);
  assert.doesNotMatch(out, /Furthermore/i);
  assert.ok(out.split(/\s+/).length <= 28);
});

test("resolveWordBudget expands for complex questions", () => {
  const budget = resolveWordBudget({
    query: "Can you explain the difference between MCA and MBA?",
    responseStyleProfile: { wordBudget: 24, mode: "balanced" },
  });
  assert.ok(budget >= 32);
});

test("diversifyOpener avoids repeating sure every turn", () => {
  const first = diversifyOpener({
    text: "Sure. MCA is a postgraduate program focused on software development.",
    turnCount: 2,
    previousAiMessage: "Sure. Are you looking for admission this year?",
  });
  assert.doesNotMatch(first, /^sure/i);
});

test("applyConversationStyle produces voice-friendly output", () => {
  const out = applyConversationStyle({
    answer: "Sure. Sure. The MCA fee is 1.2 lakh. I can help you with that.",
    userEmotion: "neutral",
    stage: "query_resolution",
    turnCount: 4,
    query: "What are the fees?",
    responseStyleProfile: { wordBudget: 22, mode: "factual" },
  });
  assert.ok(out.length > 0);
  assert.doesNotMatch(out, /i can help you with that/i);
});

test("validateResponse flags robotic definition style", () => {
  const result = validateResponse({
    answer:
      "MCA is a postgraduate degree program designed for students interested in computing.",
    query: "What is MCA?",
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.includes("robotic_definition"));
});

test("finalizeOutboundAnswer removes repeated greeting on template-style replies", () => {
  const result = finalizeOutboundAnswer({
    answer: "Hello! When are you planning to start the course?",
    query: "When can I start?",
    stage: "qualification",
    isOpeningTurn: false,
    previousAiMessage: "",
    responseStyleProfile: { wordBudget: 22, mode: "balanced" },
    enableCompliance: false,
    enableVoiceRealism: false,
  });

  assert.doesNotMatch(result.answer, /^hello/i);
  assert.ok(result.validation.issues.includes("repeated_greeting"));
  assert.match(result.answer, /start|planning/i);
});

test("enforceVoiceFriendly preserves clock times for TTS", () => {
  const out = enforceVoiceFriendly(
    "That exact time isn't open. I can offer 9:40 AM, 10:20 AM. Which works best?",
  );
  assert.match(out, /9:40 AM/);
  assert.match(out, /10:20 AM/);
  assert.doesNotMatch(out, /9, 40/);
});

test("enforceWordCap does not end on dangling fragments like when are", () => {
  const out = enforceWordCap(
    "Good question. For MCA, you need a Bachelor's degree with Mathematics at 10+2 or graduation level, and a minimum 50%. When are you planning to start?",
    24,
  );
  assert.doesNotMatch(out, /\bwhen are\.?$/i);
  assert.match(out, /50%|Bachelor/i);
});

test("finalizeOutboundAnswer keeps booking template text intact", () => {
  const bookingReply =
    "One moment, I'm checking appointment availability for you. That exact time isn't open for your appointment. I can offer 9:40 AM, 10:20 AM. Which works best?";
  const result = finalizeOutboundAnswer({
    answer: bookingReply,
    query: "Book for tomorrow 4 PM",
    stage: "appointment_booking",
    trustedTemplate: true,
    enableCompliance: false,
    enableVoiceRealism: false,
  });
  assert.match(result.answer, /9:40 AM|10:20 AM/);
  assert.match(result.answer, /which works best/i);
  assert.doesNotMatch(result.answer, /open for your\.?$/i);
});

test("finalizeOutboundAnswer applies compliance guardrails", () => {
  const result = finalizeOutboundAnswer({
    answer: "The annual fee is exactly 999999 per year.",
    query: "What are the MCA fees?",
    knowledge: "",
    stage: "query_resolution",
    enableCompliance: true,
    enableVoiceRealism: false,
  });

  assert.equal(result.compliance.compliant, false);
  assert.match(result.answer, /do not have that exact verified detail/i);
});
