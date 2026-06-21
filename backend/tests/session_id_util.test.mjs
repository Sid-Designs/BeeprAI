import assert from "node:assert/strict";
import test from "node:test";
import {
  roomNameFromSessionId,
  sessionIdFromRoomName,
} from "../utils/sessionId.util.js";

test("session id and room name round-trip for sip ids", () => {
  const sessionId = "sip-1719062400000-abc12de";
  const roomName = roomNameFromSessionId(sessionId);
  assert.equal(roomName, "room-sip-1719062400000-abc12de");
  assert.equal(sessionIdFromRoomName(roomName), sessionId);
});

test("sessionIdFromRoomName ignores non-room values", () => {
  assert.equal(sessionIdFromRoomName(""), "");
  assert.equal(sessionIdFromRoomName("call-room"), "");
});
