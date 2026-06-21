import "../config/env.js";
import fs from "node:fs";
import path from "node:path";
import connectDB from "../config/db.js";
import LeadOutcome from "../models/leadOutcome.model.js";
import { fetchKbGapClusterReport } from "../services/insights/kbGapClustering.service.js";

const OUT_DIR = path.resolve("reports");
const OUT_FILE = path.join(OUT_DIR, `nightly-${new Date().toISOString().slice(0, 10)}.json`);
const LEARN_FILE = path.join(OUT_DIR, `learning-${new Date().toISOString().slice(0, 10)}.json`);
const KB_GAPS_FILE = path.join(OUT_DIR, `kb-gaps-${new Date().toISOString().slice(0, 10)}.json`);

const topN = (map, n = 5) =>
  Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));

const compact = (value, max = 160) =>
  String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

const summarize = async () => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await LeadOutcome.find({ updatedAt: { $gte: since } })
    .select("tenantId agentId objective leadStatus stage turnCount endReason lastUserMessage lastAssistantMessage telemetry learning")
    .lean();

  const total = rows.length;
  const byLeadStatus = {};
  const byObjective = {};
  const endReasons = {};
  const goalDelta = {};
  const recoveryTypes = {};
  const variants = {};
  const outcomesByLearning = {};
  const improvementTags = {};
  let kbGateTriggers = 0;
  let avgTurns = 0;

  for (const row of rows) {
    byLeadStatus[row.leadStatus || "unknown"] = (byLeadStatus[row.leadStatus || "unknown"] || 0) + 1;
    byObjective[row.objective || "custom"] = (byObjective[row.objective || "custom"] || 0) + 1;
    endReasons[row.endReason || "none"] = (endReasons[row.endReason || "none"] || 0) + 1;
    const t = row.telemetry || {};
    if (t.goalDelta) goalDelta[t.goalDelta] = (goalDelta[t.goalDelta] || 0) + 1;
    if (t.recoveryType) recoveryTypes[t.recoveryType] = (recoveryTypes[t.recoveryType] || 0) + 1;
    if (t.abVariant) variants[t.abVariant] = (variants[t.abVariant] || 0) + 1;
    if (t.kbGateTriggered) kbGateTriggers += 1;
    const learning = row.learning || {};
    if (learning.outcomeType) {
      outcomesByLearning[learning.outcomeType] = (outcomesByLearning[learning.outcomeType] || 0) + 1;
    }
    for (const tag of Array.isArray(learning.improvementTags) ? learning.improvementTags : []) {
      improvementTags[tag] = (improvementTags[tag] || 0) + 1;
    }
    avgTurns += Number(row.turnCount || 0);
  }
  avgTurns = total ? Number((avgTurns / total).toFixed(2)) : 0;

  return {
    generatedAt: new Date().toISOString(),
    windowHours: 24,
    totalCalls: total,
    avgTurns,
    byLeadStatus,
    byObjective,
    endReasons,
    goalDelta,
    recoveryTypes,
    variants,
    outcomesByLearning,
    improvementTags,
    kbGateTriggers,
    recommendations: [
      improvementTags.knowledge_gap
        ? "Expand knowledge coverage for the top unanswered factual questions."
        : "Keep monitoring factual coverage for new gaps.",
      improvementTags.booking_conversion
        ? "Offer booking or callback slots earlier on schedule-seeking calls."
        : "Track whether booking prompts are happening at the right moment.",
      avgTurns >= 10
        ? "Reduce long-tail calls by tightening qualification and objection flow."
        : "Current turn count looks healthy; preserve concise flow.",
    ],
  };
};

const buildAutoLearningPack = async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const winners = await LeadOutcome.find({
    updatedAt: { $gte: since },
    leadStatus: { $in: ["qualified", "closed"] },
  })
    .select("objective lastAssistantMessage lastUserMessage telemetry learning")
    .lean();

  const openings = {};
  const closings = {};
  const objectionPatterns = {};

  winners.forEach((row) => {
    const assistant = compact(row.lastAssistantMessage, 180);
    const user = compact(row.lastUserMessage, 180).toLowerCase();
    if (assistant) {
      if (/\b(hello|hi|namaste|namaskar)\b/i.test(assistant)) openings[assistant] = (openings[assistant] || 0) + 1;
      if (/\b(anything else|before we close|goodbye|take care)\b/i.test(assistant)) closings[assistant] = (closings[assistant] || 0) + 1;
    }
    if (/\b(expensive|price|fees|later|busy|send details|not interested)\b/.test(user)) {
      objectionPatterns[user] = (objectionPatterns[user] || 0) + 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    sampleSize: winners.length,
    topOpenings: topN(openings, 8),
    topClosings: topN(closings, 8),
    topObjectionUtterances: topN(objectionPatterns, 12),
    topLearningOutcomes: topN(
      winners.reduce((acc, row) => {
        const key = row?.learning?.outcomeType || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
      8,
    ),
  };
};

const run = async () => {
  await connectDB();
  const report = await summarize();
  const learningPack = await buildAutoLearningPack();
  const kbGapReport = await fetchKbGapClusterReport({ windowHours: 24 });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(LEARN_FILE, JSON.stringify(learningPack, null, 2), "utf8");
  fs.writeFileSync(KB_GAPS_FILE, JSON.stringify(kbGapReport, null, 2), "utf8");
  console.log(`[nightly] report generated: ${OUT_FILE}`);
  console.log(`[nightly] learning pack generated: ${LEARN_FILE}`);
  console.log(`[nightly] kb gap clusters generated: ${KB_GAPS_FILE}`);
  process.exit(0);
};

run().catch((error) => {
  console.error("[nightly] failed:", error?.message || error);
  process.exit(1);
});
