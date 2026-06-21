import axios from "axios";
import { createSipSession } from "./sipSession.service.js";
import { createOutboundSipParticipant } from "./livekitSip.service.js";
import { startWorkerForRoom } from "./workerLauncher.js";
import { upsertLeadOutcome } from "./leadOutcome.service.js";
import { roomNameFromSessionId } from "../utils/sessionId.util.js";
import {
  assertTenantCanStartCall,
  incrementTenantCallUsage,
  buildTenantUsageSummary,
} from "./tenantUsage.service.js";
import { resolvePlatformCallerNumber } from "../config/telephony.js";

const VOBIZ_AUTH_ID = process.env.VOBIZ_AUTH_ID || "";
const VOBIZ_AUTH_TOKEN = process.env.VOBIZ_AUTH_TOKEN || "";
const VOBIZ_API_BASE = process.env.VOBIZ_API_BASE || "https://api.vobiz.ai/api/v1";
const BASE_URL = process.env.BASE_URL || "";
const LIVEKIT_SIP_DOMAIN = process.env.LIVEKIT_SIP_DOMAIN || process.env.LIVEKIT_SIP_ADDRESS || "";
const LIVEKIT_SIP_TARGET_ROOM = String(process.env.LIVEKIT_SIP_TARGET_ROOM || "").trim();
const VOBIZ_BRIDGE_MODE = String(process.env.VOBIZ_BRIDGE_MODE || "voice_app").toLowerCase();

const normalizeSipDomain = (value = "") =>
  String(value)
    .trim()
    .replace(/^sip:/i, "")
    .replace(/^\/\//, "")
    .replace(/\/.*$/, "");

const resolveTargetRoomName = (roomName) => {
  if (LIVEKIT_SIP_TARGET_ROOM) {
    return LIVEKIT_SIP_TARGET_ROOM.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  }
  return String(roomName || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
};

const buildLiveKitSipTarget = (roomName) => {
  const sipDomain = normalizeSipDomain(LIVEKIT_SIP_DOMAIN);
  if (!sipDomain) {
    throw new Error("LIVEKIT_SIP_DOMAIN (or LIVEKIT_SIP_ADDRESS) is not configured");
  }
  const safeRoom = resolveTargetRoomName(roomName);
  return `sip:${safeRoom}@${sipDomain}`;
};

const stripSipScheme = (value = "") => String(value).replace(/^sip:/i, "");

const buildWebhookUrl = (path) => {
  if (!BASE_URL) throw new Error("BASE_URL is not configured");
  return `${BASE_URL.replace(/\/$/, "")}${path}`;
};

/**
 * Start a single outbound SIP call (shared by manual and bulk flows).
 */
export async function executeOutboundCall({
  tenantId,
  agentId,
  receiverNumber,
  callObjective = "",
  callConfig = {},
  sessionMeta = {},
}) {
  const resolvedCallerNumber = resolvePlatformCallerNumber();
  if (!resolvedCallerNumber) {
    throw new Error(
      "Platform caller number is not configured. Set VOBIZ_DEFAULT_CALLER_NUMBER in server environment.",
    );
  }

  await assertTenantCanStartCall(tenantId);

  const finalSessionId = `sip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const generatedRoomName = roomNameFromSessionId(finalSessionId);
  const roomName = resolveTargetRoomName(generatedRoomName);

  const mergedConfig = {
    ...(callConfig && typeof callConfig === "object" ? callConfig : {}),
    objective: callObjective || callConfig?.objective || "",
  };

  const session = createSipSession(
    roomName,
    tenantId,
    agentId,
    receiverNumber,
    mergedConfig,
    { ...sessionMeta, sessionId: finalSessionId },
  );

  void upsertLeadOutcome({
    tenantId,
    agentId,
    sessionId: finalSessionId,
    roomName,
    objective: mergedConfig.objective || "custom",
    stage: "connecting",
    leadStatus: "new",
    collectedData: {},
    summary: "Call connecting",
    isClosed: false,
    turnCount: 0,
    lastUserMessage: "",
    lastAssistantMessage: "",
  }).catch((error) => {
    console.warn("[lead] initial outcome upsert failed:", error?.message || error);
  });

  startWorkerForRoom(roomName, {
    tenantId,
    agentId,
    sessionId: finalSessionId,
    callObjective: mergedConfig.objective,
    callConfig: mergedConfig,
  });

  let outboundSuccess = false;
  let outboundError = "";

  try {
    if (VOBIZ_BRIDGE_MODE === "livekit_outbound") {
      const participant = await createOutboundSipParticipant({
        roomName,
        to: receiverNumber,
        from: resolvedCallerNumber,
        tenantId,
        agentId,
      });
      outboundSuccess = true;
    } else if (VOBIZ_BRIDGE_MODE === "direct_sip") {
      const headers = {
        "X-Auth-ID": VOBIZ_AUTH_ID,
        "X-Auth-Token": VOBIZ_AUTH_TOKEN,
        "Content-Type": "application/json",
      };
      const sipTarget = buildLiveKitSipTarget(roomName);
      const outboundPayload = {
        from: resolvedCallerNumber,
        to: sipTarget,
        tenantId,
        agentId,
        sessionId: finalSessionId,
        roomName,
      };
      await axios.post(`${VOBIZ_API_BASE}/Account/${VOBIZ_AUTH_ID}/Call/`, outboundPayload, {
        headers,
        timeout: 10000,
      });
      outboundSuccess = true;
    } else {
      const answerUrl = buildWebhookUrl(
        `/api/call/answer?roomName=${encodeURIComponent(roomName)}`,
      );
      const hangupUrl = buildWebhookUrl(
        `/api/call/hangup?roomName=${encodeURIComponent(roomName)}`,
      );
      const headers = {
        "X-Auth-ID": VOBIZ_AUTH_ID,
        "X-Auth-Token": VOBIZ_AUTH_TOKEN,
        "Content-Type": "application/json",
      };
      const outboundPayload = {
        from: resolvedCallerNumber,
        to: receiverNumber,
        answer_url: answerUrl,
        hangup_url: hangupUrl,
        tenantId,
        agentId,
        sessionId: finalSessionId,
        roomName,
      };
      await axios.post(`${VOBIZ_API_BASE}/Account/${VOBIZ_AUTH_ID}/Call/`, outboundPayload, {
        headers,
        timeout: 10000,
      });
      outboundSuccess = true;
    }
  } catch (err) {
    outboundError = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message || "Outbound call failed";
  }

  const tenantAfterCall = await incrementTenantCallUsage(tenantId);
  const usage = tenantAfterCall ? await buildTenantUsageSummary(tenantAfterCall) : null;

  if (!outboundSuccess) {
    return {
      success: false,
      sessionId: finalSessionId,
      roomName,
      error: outboundError,
      usage,
    };
  }

  return {
    success: true,
    sessionId: finalSessionId,
    roomName,
    callerNumber: resolvedCallerNumber,
    receiverNumber,
    usage,
    session,
  };
}
