import { formatSnakeCase } from "./callDetail";

export const DEFAULT_LIVE_CALL_POLL_INTERVAL_MS = 3000;

export function getLiveCallPollInterval(): number {
  const raw = Number(process.env.NEXT_PUBLIC_LIVE_CALL_POLL_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_LIVE_CALL_POLL_INTERVAL_MS;
}

export function isLiveCallPollingEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_ENABLE_LIVE_CALL_POLLING ?? "true").toLowerCase() !== "false";
}

export const CALL_STAGE_MILESTONES = [
  { key: "opening", label: "Opening" },
  { key: "intent_discovery", label: "Discovery" },
  { key: "qualification", label: "Qualification" },
  { key: "appointment_booking", label: "Booking" },
  { key: "closing", label: "Closing" },
  { key: "completed", label: "Done" },
] as const;

const STAGE_TO_MILESTONE_INDEX: Record<string, number> = {
  opening: 0,
  intent_discovery: 1,
  discovery: 1,
  qualification: 2,
  information_collection: 2,
  query_resolution: 2,
  objection_handling: 2,
  booking_readiness: 3,
  appointment_booking: 3,
  confirmation: 3,
  callback: 3,
  closing: 4,
  completed: 5,
};

export type StageMilestoneState = "complete" | "current" | "upcoming";

export type StageMilestoneView = {
  key: string;
  label: string;
  state: StageMilestoneState;
};

export function resolveStageMilestoneIndex(stage?: string): number {
  const normalized = String(stage || "opening")
    .trim()
    .toLowerCase();
  if (STAGE_TO_MILESTONE_INDEX[normalized] != null) {
    return STAGE_TO_MILESTONE_INDEX[normalized];
  }
  return 0;
}

export function buildStageMilestones(stage?: string): StageMilestoneView[] {
  const activeIndex = resolveStageMilestoneIndex(stage);

  return CALL_STAGE_MILESTONES.map((milestone, index) => ({
    key: milestone.key,
    label: milestone.label,
    state: index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming",
  }));
}

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New lead",
  interested: "Interested",
  qualified: "Qualified",
  unsure: "Unsure",
  not_interested: "Not interested",
  closed: "Closed",
};

export function labelLeadStatus(status?: string): string {
  const key = String(status || "new")
    .trim()
    .toLowerCase();
  return LEAD_STATUS_LABELS[key] || formatSnakeCase(key) || "New lead";
}
