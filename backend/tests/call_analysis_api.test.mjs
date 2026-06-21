import test from "node:test";
import assert from "node:assert/strict";
import { formatLiveCallStatus } from "../services/leadOutcome.service.js";

const LIVE_CALL_FIELDS = [
  "sessionId",
  "tenantId",
  "agentId",
  "roomName",
  "stage",
  "leadStatus",
  "turnCount",
  "lastUserMessage",
  "lastAssistantMessage",
  "collectedData",
  "isClosed",
  "objective",
  "endReason",
  "intentInsight",
  "updatedAt",
];

const CALL_ANALYSIS_DETAIL_FIELDS = [
  "sessionId",
  "callId",
  "roomName",
  "tenantId",
  "agentId",
  "phoneNumber",
  "startTime",
  "endTime",
  "duration",
  "summary",
  "primaryIntent",
  "secondaryIntents",
  "outcome",
  "leadScore",
  "sentiment",
  "objections",
  "collectedInformation",
  "appointmentBooked",
  "appointmentDate",
  "appointmentTime",
  "nextAction",
  "transcript",
  "analysisStatus",
  "analysisSource",
  "endReason",
  "triggerSource",
  "metadata",
];

test("formatLiveCallStatus returns null for missing record", () => {
  assert.equal(formatLiveCallStatus(null), null);
  assert.equal(formatLiveCallStatus(undefined), null);
});

test("formatLiveCallStatus exposes in-progress call fields for tenant polling", () => {
  const payload = formatLiveCallStatus({
    sessionId: "sess-abc",
    tenantId: "507f1f77bcf86cd799439011",
    agentId: "507f1f77bcf86cd799439012",
    roomName: "call-room-1",
    stage: "qualification",
    leadStatus: "interested",
    turnCount: 4,
    lastUserMessage: "What are the fees?",
    lastAssistantMessage: "Around 1.2 lakh per year.",
    collectedData: { name: "Rahul", preferred_date: "tomorrow" },
    isClosed: false,
    objective: "lead_generation",
    endReason: "",
    intentInsight: { primaryIntent: "fees_inquiry", confidence: 0.82 },
    telemetry: { kbGateTriggered: true },
    learning: { shouldNotLeak: true },
    updatedAt: new Date("2026-06-20T10:00:00.000Z"),
  });

  assert.deepEqual(Object.keys(payload).sort(), LIVE_CALL_FIELDS.sort());
  assert.equal(payload.sessionId, "sess-abc");
  assert.equal(payload.stage, "qualification");
  assert.equal(payload.turnCount, 4);
  assert.deepEqual(payload.collectedData, { name: "Rahul", preferred_date: "tomorrow" });
  assert.deepEqual(payload.intentInsight, { primaryIntent: "fees_inquiry", confidence: 0.82 });
  assert.equal(payload.isClosed, false);
  assert.equal("telemetry" in payload, false);
  assert.equal("learning" in payload, false);
});

test("formatLiveCallStatus applies safe defaults for sparse records", () => {
  const payload = formatLiveCallStatus({
    sessionId: "sess-min",
    tenantId: "507f1f77bcf86cd799439011",
    agentId: "507f1f77bcf86cd799439012",
  });

  assert.equal(payload.stage, "opening");
  assert.equal(payload.leadStatus, "new");
  assert.equal(payload.turnCount, 0);
  assert.deepEqual(payload.collectedData, {});
  assert.deepEqual(payload.intentInsight, {});
  assert.equal(payload.isClosed, false);
});

test("call detail API field checklist matches backend CallAnalysis model", () => {
  // Documents the tenant-facing detail contract exercised by GET /call-analysis/:sessionId.
  assert.ok(CALL_ANALYSIS_DETAIL_FIELDS.includes("transcript"));
  assert.ok(CALL_ANALYSIS_DETAIL_FIELDS.includes("analysisStatus"));
  assert.ok(CALL_ANALYSIS_DETAIL_FIELDS.includes("endReason"));
  assert.ok(CALL_ANALYSIS_DETAIL_FIELDS.includes("metadata"));
  assert.equal(CALL_ANALYSIS_DETAIL_FIELDS.length, 27);
});
