import test from "node:test";
import assert from "node:assert/strict";
import {
  isKbGapSignal,
  classifyKbGapTopic,
  clusterKbGapRecords,
  buildKbGapClusterReport,
  extractGapSampleQuery,
} from "../services/insights/kbGapClustering.service.js";

const feeRecord = {
  sessionId: "sess-fee-1",
  outcome: "unanswered",
  primaryIntent: "fee_inquiry",
  metadata: { kbGateTriggered: true },
  transcript: [
    { speaker: "user", message: "What are the MCA fees for this year?" },
    { speaker: "assistant", message: "I do not have that exact verified detail right now." },
  ],
};

const abandonedRecord = {
  sessionId: "sess-abandon-1",
  outcome: "abandoned",
  primaryIntent: "unknown",
  metadata: {},
  transcript: [
    { speaker: "user", message: "Tell me about admission steps" },
    { speaker: "assistant", message: "Sure, admissions include document submission." },
  ],
};

test("isKbGapSignal detects kb gate and abandoned outcomes", () => {
  assert.equal(isKbGapSignal(feeRecord), true);
  assert.equal(isKbGapSignal(abandonedRecord), true);
  assert.equal(
    isKbGapSignal({ outcome: "appointment_booked", metadata: {} }),
    false,
  );
});

test("classifyKbGapTopic prefers primary intent then transcript keywords", () => {
  assert.equal(classifyKbGapTopic(feeRecord), "fee_inquiry");
  assert.equal(classifyKbGapTopic(abandonedRecord), "admission");
});

test("extractGapSampleQuery returns the most relevant user line", () => {
  assert.match(extractGapSampleQuery(feeRecord), /MCA fees/i);
});

test("clusterKbGapRecords groups signals by topic", () => {
  const clusters = clusterKbGapRecords([feeRecord, abandonedRecord, { ...feeRecord, sessionId: "sess-fee-2" }]);
  assert.ok(clusters.length >= 2);
  const fees = clusters.find((cluster) => cluster.id === "fee_inquiry");
  assert.equal(fees?.signalCount, 2);
  assert.equal(fees?.kbGateCount, 2);
  assert.ok(fees?.sampleQueries.length >= 1);
});

test("buildKbGapClusterReport includes recommendations", () => {
  const report = buildKbGapClusterReport({
    records: [feeRecord, abandonedRecord],
    tenantId: "tenant-1",
    windowHours: 24,
  });
  assert.equal(report.totalSignals, 2);
  assert.ok(report.clusters.length >= 1);
  assert.ok(report.recommendations.length >= 1);
});
