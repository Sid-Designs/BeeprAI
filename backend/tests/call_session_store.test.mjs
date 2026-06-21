import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionForTests,
  createDefaultSession,
  ensureSessionHydrated,
  getSessionStoreMode,
  readSession,
  saveSession,
  updateSession,
} from "../services/session/callSessionStore.service.js";
import {
  addMessageToSession,
  getSessionCallState,
  getSessionContext,
  getSessionMessages,
  setSessionCallState,
  setSessionContext,
} from "../services/memory.service.js";
import { sessionKey } from "../config/redis.js";

test("sessionKey uses planned redis namespaces", () => {
  assert.equal(sessionKey("abc-123", "messages"), "session:abc-123:messages");
  assert.equal(sessionKey("abc-123", "callState"), "session:abc-123:callState");
  assert.equal(sessionKey("abc-123", "context"), "session:abc-123:context");
});

test("memory service keeps sync API over local session store", async () => {
  const sessionId = "test-session-sync";
  clearSessionForTests(sessionId);
  await ensureSessionHydrated(sessionId);

  addMessageToSession(sessionId, "user", "What are the MCA fees?");
  addMessageToSession(sessionId, "assistant", "I can help with MCA fees.");
  setSessionContext(sessionId, "fee context");
  setSessionCallState(sessionId, { stage: "query_resolution", leadStatus: "interested" });

  assert.equal(getSessionMessages(sessionId).length, 2);
  assert.equal(getSessionContext(sessionId), "fee context");
  assert.equal(getSessionCallState(sessionId)?.stage, "query_resolution");
  assert.equal(getSessionStoreMode(), "memory");
});

test("call session store round-trips session mutations in memory mode", async () => {
  const sessionId = "test-session-roundtrip";
  clearSessionForTests(sessionId);
  await ensureSessionHydrated(sessionId);

  updateSession(sessionId, (session) => ({
    ...session,
    messages: [{ role: "user", content: "Hello" }],
    lastContext: "ctx",
    callState: { stage: "opening" },
  }));

  const stored = readSession(sessionId);
  assert.equal(stored.messages[0].content, "Hello");
  assert.equal(stored.lastContext, "ctx");
  assert.equal(stored.callState.stage, "opening");

  saveSession(sessionId, createDefaultSession());
  clearSessionForTests(sessionId);
});
