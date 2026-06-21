import mongoose from "mongoose";
import CallAnalysis from "../models/callAnalysis.model.js";
import Agent from "../models/agent.model.js";
import KnowledgeBase from "../models/knowledgeBase.model.js";

const SUCCESS_OUTCOMES = new Set([
  "appointment_booked",
  "callback_scheduled",
  "qualified_lead",
  "information_provided",
]);

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildLast7DayBuckets() {
  const buckets = [];
  const today = startOfDay();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const start = new Date(today);
    start.setDate(start.getDate() - offset);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({ start, end, label: start.toLocaleDateString("en-US", { weekday: "short" }) });
  }

  return buckets;
}

export async function getTenantAnalyticsSummary(tenantId) {
  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const sevenDaysAgo = startOfDay();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const calls = await CallAnalysis.find({
    tenantId: tenantOid,
    createdAt: { $gte: sevenDaysAgo },
  })
    .select("createdAt outcome duration leadScore agentId appointmentBooked")
    .lean();

  const todayStart = startOfDay();
  const callsToday = calls.filter((call) => new Date(call.createdAt) >= todayStart).length;

  const successfulCalls = calls.filter((call) => SUCCESS_OUTCOMES.has(call.outcome)).length;
  const successRate =
    calls.length > 0 ? Math.round((successfulCalls / calls.length) * 100) : 0;

  const bookedCalls = calls.filter(
    (call) => call.outcome === "appointment_booked" || call.appointmentBooked,
  ).length;
  const conversionRate =
    calls.length > 0 ? Math.round((bookedCalls / calls.length) * 100) : 0;

  const durations = calls
    .map((call) => Number(call.duration || 0))
    .filter((ms) => ms > 0);
  const avgCallDurationSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / durations.length / 1000)
      : 0;

  const agentCounts = new Map();
  for (const call of calls) {
    const id = call.agentId?.toString();
    if (!id) continue;
    agentCounts.set(id, (agentCounts.get(id) || 0) + 1);
  }

  let topPerformer = null;
  const topEntry = [...agentCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topEntry) {
    const agent = await Agent.findById(topEntry[0]).select("name").lean();
    topPerformer = {
      agentId: topEntry[0],
      name: agent?.name || "Agent",
      calls: topEntry[1],
    };
  }

  const buckets = buildLast7DayBuckets();
  const dailyVolume = buckets.map((bucket) => {
    const count = calls.filter((call) => {
      const created = new Date(call.createdAt);
      return created >= bucket.start && created < bucket.end;
    }).length;
    return { label: bucket.label, count };
  });

  const maxDaily = Math.max(...dailyVolume.map((d) => d.count), 1);
  const dailyBarHeights = dailyVolume.map((d) => Math.round((d.count / maxDaily) * 100));

  const activeAgents = await Agent.countDocuments({ tenantId: tenantOid, isActive: true });
  const knowledgeDocIds = await KnowledgeBase.distinct("docId", { tenantId: tenantOid });

  return {
    tenantId,
    periodDays: 7,
    totalCalls: calls.length,
    callsToday,
    successRate,
    conversionRate,
    avgCallDurationSeconds,
    topPerformer,
    activeAgents,
    knowledgeSourceCount: knowledgeDocIds.length,
    dailyVolume,
    dailyBarHeights,
  };
}
