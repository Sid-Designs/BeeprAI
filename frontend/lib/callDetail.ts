import type { AnalysisStatus, CallAnalysis, IntentInsight } from "@/lib/types";

const END_REASON_LABELS: Record<string, string> = {
  user_not_interested: "Customer not interested",
  not_interested: "Customer not interested",
  user_requested_end: "Customer ended the call",
  conversation_closed: "Conversation completed",
  user_confirmed_closing: "Customer confirmed closing",
  appointment_confirmed: "Appointment confirmed on call",
  callback_scheduled: "Callback requested",
  user_requested_callback: "Callback requested",
  room_ended: "Call room closed",
  no_answer: "No answer",
  unanswered: "Unanswered",
  silence_timeout: "Ended after silence",
  abandoned: "Customer left early",
  openai_quota_or_rate_limited: "AI service limit reached",
};

const OUTCOME_LABELS: Record<string, string> = {
  appointment_booked: "Appointment booked",
  callback_scheduled: "Callback scheduled",
  qualified_lead: "Qualified lead",
  information_provided: "Information provided",
  not_interested: "Not interested",
  abandoned: "Abandoned",
  unanswered: "Unanswered",
  unknown: "Unknown",
};

const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

/** Backend call analysis stores duration in milliseconds. */
export function normalizeDurationSeconds(raw?: number | null): number {
  const value = Number(raw ?? 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1000) return Math.round(value / 1000);
  return Math.round(value);
}

export function formatCallDuration(raw?: number | null): string {
  const totalSeconds = normalizeDurationSeconds(raw);
  if (totalSeconds <= 0) return "—";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function formatCallLabel(call?: CallAnalysis | null): string {
  const phone = String(call?.phoneNumber || "").trim();
  if (phone) return phone;
  const session = String(call?.sessionId || "").trim();
  if (session) return `Call ${session.slice(-8)}`;
  return "Customer";
}

export function formatSnakeCase(value?: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function labelEndReason(reason?: string): string {
  const key = String(reason || "")
    .trim()
    .toLowerCase();
  if (!key) return "Not recorded";
  if (END_REASON_LABELS[key]) return END_REASON_LABELS[key];

  if (key.includes("not_interested")) return END_REASON_LABELS.not_interested;
  if (key.includes("callback")) return END_REASON_LABELS.callback_scheduled;
  if (key.includes("appointment")) return END_REASON_LABELS.appointment_confirmed;
  if (key.includes("silence")) return END_REASON_LABELS.silence_timeout;
  if (key.includes("abandon")) return END_REASON_LABELS.abandoned;
  if (key.includes("no_answer") || key.includes("unanswered")) return END_REASON_LABELS.unanswered;

  return formatSnakeCase(key);
}

export function labelOutcome(outcome?: string): string {
  const key = String(outcome || "")
    .trim()
    .toLowerCase();
  if (!key) return "In progress";
  return OUTCOME_LABELS[key] || formatSnakeCase(key);
}

export function labelAnalysisStatus(status?: AnalysisStatus | string): string {
  const key = String(status || "pending").toLowerCase() as AnalysisStatus;
  return ANALYSIS_STATUS_LABELS[key] || formatSnakeCase(key);
}

export function analysisStatusTone(
  status?: AnalysisStatus | string,
): "neutral" | "info" | "success" | "error" {
  const key = String(status || "pending").toLowerCase();
  if (key === "completed") return "success";
  if (key === "failed") return "error";
  if (key === "processing") return "info";
  return "neutral";
}

export function isAnalysisPending(call?: Pick<CallAnalysis, "analysisStatus"> | null): boolean {
  const status = String(call?.analysisStatus || "pending").toLowerCase();
  return status === "pending" || status === "processing";
}

export const DEFAULT_ANALYSIS_POLL_INTERVAL_MS = 4000;

export function getAnalysisPollInterval(): number {
  const raw = Number(process.env.NEXT_PUBLIC_ANALYSIS_POLL_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 2000 ? raw : DEFAULT_ANALYSIS_POLL_INTERVAL_MS;
}

export function formatIntentInsight(insight?: IntentInsight | null): string {
  if (!insight || typeof insight !== "object") return "Unknown";

  const primary = insight.primaryIntent || insight.intent;
  const parts: string[] = [];

  if (primary) parts.push(formatSnakeCase(primary));
  if (typeof insight.confidence === "number" && Number.isFinite(insight.confidence)) {
    const pct = insight.confidence <= 1
      ? Math.round(insight.confidence * 100)
      : Math.round(insight.confidence);
    parts.push(`${pct}% confidence`);
  }
  if (Array.isArray(insight.subTopics) && insight.subTopics.length) {
    parts.push(
      `Topics: ${insight.subTopics.map((topic) => formatSnakeCase(topic)).join(", ")}`,
    );
  }

  return parts.length ? parts.join(" · ") : "Unknown";
}

export function formatAnalyticsEntries(
  analytics?: Record<string, unknown> | null,
): Array<{ label: string; value: string }> {
  if (!analytics || typeof analytics !== "object") return [];

  const entries: Array<{ label: string; value: string }> = [];

  if (analytics.interruptions != null) {
    entries.push({ label: "Interruptions", value: String(analytics.interruptions) });
  }
  if (analytics.fallbackCount != null) {
    entries.push({ label: "Fallback responses", value: String(analytics.fallbackCount) });
  }
  if (analytics.successfulAnswers != null) {
    entries.push({ label: "Successful answers", value: String(analytics.successfulAnswers) });
  }
  if (analytics.engagementLevel != null) {
    entries.push({ label: "Engagement", value: String(analytics.engagementLevel) });
  }

  const latency = analytics.latencyAvg || analytics.latency;
  if (latency && typeof latency === "object") {
    const lat = latency as Record<string, unknown>;
    for (const [key, val] of Object.entries(lat)) {
      if (typeof val === "number" && val > 0) {
        entries.push({ label: `${formatSnakeCase(key)} latency`, value: `${Math.round(val)}ms` });
      }
    }
  }

  return entries;
}

export function formatCollectedEntries(
  data?: Record<string, unknown> | null,
): Array<{ key: string; value: string }> {
  if (!data || typeof data !== "object") return [];

  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => ({
      key: formatSnakeCase(key),
      value: typeof value === "object" ? JSON.stringify(value) : String(value),
    }));
}

export function formatTranscriptTimestamp(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
