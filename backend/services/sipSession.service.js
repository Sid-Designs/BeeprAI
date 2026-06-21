const sessions = new Map();

const normalizeRoom = (value) => {
  if (!value) return "";
  return String(value).trim();
};

export const createSipSession = (roomName, tenantId, agentId, did, callConfig = null, meta = null) => {
  const room = normalizeRoom(roomName);
  if (!room) throw new Error("roomName is required");

  if (sessions.has(room)) {
    const existing = sessions.get(room);
    if (callConfig && typeof callConfig === "object") {
      existing.callConfig = { ...(existing.callConfig || {}), ...callConfig };
    }
    if (meta && typeof meta === "object") {
      existing.meta = { ...(existing.meta || {}), ...meta };
    }
    return existing;
  }

  const session = {
    roomName: room,
    tenantId,
    agentId,
    did,
    dispatchRuleId: null,
    callConfig: callConfig && typeof callConfig === "object" ? callConfig : null,
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: new Date().toISOString(),
  };

  sessions.set(room, session);
  return session;
};

export const getSipSession = (roomName) => {
  const room = normalizeRoom(roomName);
  if (!room) return null;
  return sessions.get(room) || null;
};

export const setSipSessionDispatchRule = (roomName, dispatchRuleId) => {
  const session = getSipSession(roomName);
  if (!session) return null;

  session.dispatchRuleId = dispatchRuleId || null;
  return session;
};

export const removeSipSession = (roomName) => {
  const room = normalizeRoom(roomName);
  if (!room) return null;
  const session = sessions.get(room) || null;
  sessions.delete(room);
  return session;
};
