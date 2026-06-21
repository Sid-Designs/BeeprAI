import { listKbGapSignalAnalyses } from "../postCall/postCallAnalysis.service.js";

const cleanText = (value = "", max = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const TOPIC_PATTERNS = [
  { id: "fees", label: "Fees and pricing", re: /\b(fee|fees|price|pricing|cost|tuition|scholarship)\b/i },
  { id: "admission", label: "Admission process", re: /\b(admission|apply|application|enroll)\b/i },
  { id: "eligibility", label: "Eligibility", re: /\b(eligib|criteria|qualif)\b/i },
  { id: "appointment", label: "Scheduling", re: /\b(appointment|schedule|book|callback|counselor)\b/i },
  { id: "course", label: "Course details", re: /\b(course|program|syllabus|duration|mca|mba|bca|bba)\b/i },
  { id: "placement", label: "Placements", re: /\b(placement|job|career|internship)\b/i },
];

const INTENT_LABELS = Object.freeze({
  fee_inquiry: "Fees and pricing",
  admission_inquiry: "Admission process",
  information_request: "General information",
  appointment_booking: "Scheduling",
  support_request: "Support",
  callback_request: "Callback",
  fees: "Fees and pricing",
  admission: "Admission process",
  eligibility: "Eligibility",
  course: "Course details",
  placement: "Placements",
  general_inquiry: "General inquiry",
  unknown: "Unclassified questions",
});

const normalizeIntentKey = (value = "") =>
  cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const isKbGapSignal = (record = {}) => {
  const outcome = cleanText(record.outcome, 40).toLowerCase();
  if (outcome === "abandoned" || outcome === "unanswered") return true;

  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const analytics =
    metadata.analytics && typeof metadata.analytics === "object" ? metadata.analytics : {};

  return analytics.kbGateTriggered === true || metadata.kbGateTriggered === true;
};

export const extractGapSampleQuery = (record = {}) => {
  const transcript = Array.isArray(record.transcript) ? record.transcript : [];
  const userTurns = transcript
    .filter((turn) => turn?.speaker === "user")
    .map((turn) => cleanText(turn.message, 180))
    .filter(Boolean);

  const factualTurn = [...userTurns]
    .reverse()
    .find((message) => /\b(fee|fees|admission|eligib|course|when|how|what|price)\b/i.test(message));

  return factualTurn || userTurns[userTurns.length - 1] || cleanText(record.summary, 180);
};

export const classifyKbGapTopic = (record = {}) => {
  const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const intentInsight =
    metadata.intentInsight && typeof metadata.intentInsight === "object"
      ? metadata.intentInsight
      : {};

  const intent = normalizeIntentKey(
    record.primaryIntent || intentInsight.primaryIntent || intentInsight.intent || "",
  );
  if (intent && intent !== "unknown") return intent;

  const sample = extractGapSampleQuery(record);
  for (const pattern of TOPIC_PATTERNS) {
    if (pattern.re.test(sample)) return pattern.id;
  }

  return "general_inquiry";
};

export const topicLabelForKey = (topicKey = "") =>
  INTENT_LABELS[topicKey] ||
  TOPIC_PATTERNS.find((pattern) => pattern.id === topicKey)?.label ||
  cleanText(topicKey, 80).replace(/_/g, " ") ||
  "Unclassified questions";

const recommendedActionForTopic = (topicKey = "") => {
  switch (topicKey) {
    case "fees":
    case "fee_inquiry":
      return "Add verified fee ranges, payment options, and scholarship notes to the knowledge base.";
    case "admission":
    case "admission_inquiry":
      return "Document the admission steps, deadlines, and required documents in the knowledge base.";
    case "eligibility":
      return "Publish clear eligibility criteria and exceptions for top asked courses.";
    case "appointment":
    case "appointment_booking":
      return "Clarify booking paths and counselor availability in KB or playbook templates.";
    case "course":
      return "Add concise course overviews (duration, outcomes, who it is for) to the KB.";
    case "placement":
      return "Add placement or career outcome facts that agents can cite on calls.";
    default:
      return "Review repeated caller questions and add verified answers to the knowledge base.";
  }
};

const pushUnique = (list = [], value = "", max = 5) => {
  const text = cleanText(value, 180);
  if (!text || list.includes(text)) return list;
  return [...list, text].slice(0, max);
};

export const clusterKbGapRecords = (records = []) => {
  const clusters = new Map();

  for (const record of records) {
    if (!isKbGapSignal(record)) continue;

    const topicKey = classifyKbGapTopic(record);
    const existing = clusters.get(topicKey) || {
      id: topicKey,
      label: topicLabelForKey(topicKey),
      signalCount: 0,
      kbGateCount: 0,
      abandonedCount: 0,
      unansweredCount: 0,
      sampleQueries: [],
      sampleSessionIds: [],
      recommendedAction: recommendedActionForTopic(topicKey),
    };

    existing.signalCount += 1;
    const outcome = cleanText(record.outcome, 40).toLowerCase();
    const metadata = record.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const analytics =
      metadata.analytics && typeof metadata.analytics === "object" ? metadata.analytics : {};
    const kbGate =
      analytics.kbGateTriggered === true || metadata.kbGateTriggered === true;

    if (kbGate) existing.kbGateCount += 1;
    if (outcome === "abandoned") existing.abandonedCount += 1;
    if (outcome === "unanswered") existing.unansweredCount += 1;

    existing.sampleQueries = pushUnique(
      existing.sampleQueries,
      extractGapSampleQuery(record),
    );
    existing.sampleSessionIds = pushUnique(
      existing.sampleSessionIds,
      record.sessionId,
      8,
    );

    clusters.set(topicKey, existing);
  }

  return [...clusters.values()].sort((left, right) => right.signalCount - left.signalCount);
};

export const buildKbGapClusterReport = ({
  records = [],
  tenantId = "",
  agentId = "",
  windowHours = 24,
  generatedAt = new Date().toISOString(),
} = {}) => {
  const clusters = clusterKbGapRecords(records);
  const totalSignals = clusters.reduce((sum, cluster) => sum + cluster.signalCount, 0);

  return {
    generatedAt,
    windowHours,
    tenantId: tenantId ? String(tenantId) : "",
    agentId: agentId ? String(agentId) : "",
    totalSignals,
    clusterCount: clusters.length,
    clusters,
    recommendations: clusters.slice(0, 3).map((cluster) => ({
      topic: cluster.label,
      action: cluster.recommendedAction,
      signalCount: cluster.signalCount,
    })),
  };
};

export const fetchKbGapClusterReport = async ({
  tenantId = "",
  agentId = "",
  windowHours = 24,
} = {}) => {
  const records = await listKbGapSignalAnalyses({ tenantId, agentId, windowHours });
  return buildKbGapClusterReport({
    records,
    tenantId,
    agentId,
    windowHours,
  });
};
