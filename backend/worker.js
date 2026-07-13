import "./config/env.js";
import { startLiveKitWorker } from "./services/livekit.worker.js";

const [, , argRoomName = "", argTenantId = "", argAgentId = "", argMetadata = ""] = process.argv;
const roomName = argRoomName || process.env.ROOM_NAME || "";
const tenantId = argTenantId || process.env.TENANT_ID || "";
const agentId = argAgentId || process.env.AGENT_ID || "";
const workerMetadataRaw = argMetadata || process.env.WORKER_METADATA || "";
const parseWorkerMetadata = (raw) => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const shutdown = (room) => {
  if (!room) return;

  try {
    room.disconnect();
  } catch {
    // best effort
  }
};

if (!roomName || !tenantId || !agentId) {
  console.error("[worker] roomName, tenantId, and agentId are required");
  process.exit(1);
}

let room;
const workerMetadata = parseWorkerMetadata(workerMetadataRaw);

try {
  console.log(`[worker] started room=${roomName} tenantId=${tenantId} agentId=${agentId}`);
  room = await startLiveKitWorker(roomName, {
    tenantId,
    agentId,
    sessionId: workerMetadata?.sessionId || "",
    callObjective: workerMetadata?.callObjective || "",
    callConfig: workerMetadata?.callConfig || null,
    roomName: workerMetadata?.roomName || roomName,
  });
} catch (error) {
  console.error("[worker] failed:", error?.message || error);
  process.exit(1);
}

process.on("SIGINT", () => {
  shutdown(room);
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown(room);
  process.exit(0);
});
