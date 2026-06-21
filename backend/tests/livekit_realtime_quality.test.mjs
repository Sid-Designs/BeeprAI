import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workerPath = path.resolve("services/livekit.worker.js");
const content = fs.readFileSync(workerPath, "utf8");

test("streaming turn pipeline defaults to enabled for lower latency", () => {
  assert.match(content, /ENABLE_STREAMING_TURN_PIPELINE[\s\S]*\|\| "true"/);
});

test("quick ack fast path is disabled", () => {
  const start = content.indexOf("const resolveFastIntentReply =");
  const end = content.indexOf("const detectTurnIntent =", start);
  const block = start >= 0 && end > start ? content.slice(start, end) : "";
  assert.equal(/QUICK_ACK_RE\.test\(value\)/.test(block), false);
});

test("weak answer recovery helper exists for llm_turn fallback only", () => {
  assert.match(content, /const recoverWeakAnswer/);
  assert.match(content, /applyWorkerRecovery/);
  assert.match(content, /llm_turn only/);
});

test("stale request sequence guard exists", () => {
  assert.match(content, /aiRequestSeq/);
  assert.match(content, /ai_stale_seq_skipped/);
});

test("outgoing answer cleanup exists for dangling endings", () => {
  assert.match(content, /const cleanOutgoingAnswer/);
  assert.match(content, /DANGLING_END_RE/);
});

test("partial carry and tts dedup guards exist", () => {
  assert.match(content, /partialCarryText/);
  assert.match(content, /partial_carry_wait/);
  assert.match(content, /tts_dedup_skipped/);
});

test("worker uses two-stage silence presence flow", () => {
  assert.match(content, /buildSilencePresencePrompt/);
  assert.match(content, /buildSilenceGoodbye/);
  assert.match(content, /silence_prompt/);
  assert.match(content, /SILENCE_PROMPT_WAIT_MS/);
  assert.match(content, /REALTIME_HISTORY_MESSAGES/);
  assert.doesNotMatch(content, /conversationHistory\.slice\(-10\)/);
});

test("stale user text guard exists after turn merge", () => {
  assert.match(content, /ai_stale_user_text/);
  assert.match(content, /commitMergedTurn/);
  assert.match(content, /isTurnStillValid/);
});

test("barge-in allows short acknowledgements", () => {
  const start = content.indexOf("barge_fragment_ignored");
  const block = content.slice(Math.max(0, start - 400), start + 200);
  assert.match(block, /SHORT_USER_TURN_ALLOW_RE/);
});

test("initial response grace period defers silence prompt", () => {
  assert.match(content, /INITIAL_RESPONSE_GRACE_MS/);
  assert.match(content, /awaitingFirstUserResponse/);
});

test("streaming TTS is opt-in; WAV playback is the default", () => {
  const ttsPath = path.resolve("services/tts.service.js");
  const ttsContent = fs.readFileSync(ttsPath, "utf8");
  assert.match(ttsContent, /ENABLE_TTS_STREAMING[\s\S]*\|\| "false"/);
});

test("streaming TTS prefetch and playback hooks exist when enabled", () => {
  assert.match(content, /ENABLE_TTS_STREAMING/);
  assert.match(content, /openSpeechStream/);
  assert.match(content, /beginTtsHeadPrefetch/);
  assert.match(content, /tts_prefetch_start/);
  assert.match(content, /createStreamingTTSPlayback/);
  assert.match(content, /warmupTtsConnection/);
  assert.match(content, /abandonSpeechStream/);
});
