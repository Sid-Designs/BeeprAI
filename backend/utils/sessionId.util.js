/** Derive LiveKit room name from a call session id (matches startSipCall). */
export const roomNameFromSessionId = (sessionId = "") => {
  const value = String(sessionId || "").trim();
  if (!value) return "";
  return `room-${value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 50)}`;
};

/** Reverse room name → session id when the room was created from a session id. */
export const sessionIdFromRoomName = (roomName = "") => {
  const normalized = String(roomName || "").trim();
  if (!normalized.startsWith("room-")) return "";
  return normalized.slice(5).trim();
};
