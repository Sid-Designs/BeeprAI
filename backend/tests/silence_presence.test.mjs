import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSilenceGoodbye,
  buildSilencePresencePrompt,
} from "../services/conversation/silencePresence.service.js";

test("silence prompt for general english conversation", () => {
  const prompt = buildSilencePresencePrompt({ language: "en", hasUserSpoken: true });
  assert.match(prompt, /still there/i);
  assert.match(prompt, /anything else/i);
});

test("silence prompt during booking", () => {
  const prompt = buildSilencePresencePrompt({
    language: "en",
    inBooking: true,
    hasUserSpoken: true,
  });
  assert.match(prompt, /appointment/i);
});

test("silence prompt when user never spoke after greeting", () => {
  const prompt = buildSilencePresencePrompt({ language: "en", hasUserSpoken: false });
  assert.match(prompt, /still there|listen/i);
  assert.match(prompt, /admission/i);
});

test("silence goodbye english", () => {
  const goodbye = buildSilenceGoodbye({ language: "en" });
  assert.match(goodbye, /close the call/i);
  assert.match(goodbye, /goodbye/i);
});

test("silence prompt hindi", () => {
  const prompt = buildSilencePresencePrompt({ language: "hi", hasUserSpoken: true });
  assert.match(prompt, /अभी भी/);
});
