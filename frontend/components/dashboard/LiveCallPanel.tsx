"use client";

import { formatCollectedEntries, formatIntentInsight, formatSnakeCase, labelEndReason } from "@/lib/callDetail";
import { buildStageMilestones, labelLeadStatus } from "@/lib/liveCall";
import { useLiveCallPolling } from "@/hooks/useLiveCallPolling";
import type { LeadOutcomeLive } from "@/lib/types";
import { cn } from "@/lib/cn";
import { InlineAlert } from "@/components/shared/InlineAlert";

function StageTimeline({ stage }: { stage?: string }) {
  const milestones = buildStageMilestones(stage);

  return (
    <ol className="flex flex-wrap gap-2">
      {milestones.map((milestone) => (
        <li
          key={milestone.key}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            milestone.state === "complete" && "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
            milestone.state === "current" && "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
            milestone.state === "upcoming" && "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              milestone.state === "complete" && "bg-[#22C55E]",
              milestone.state === "current" && "bg-[#2563EB] animate-pulse",
              milestone.state === "upcoming" && "bg-[#CBD5E1]",
            )}
          />
          {milestone.label}
        </li>
      ))}
    </ol>
  );
}

function LiveCallBody({ status }: { status: LeadOutcomeLive }) {
  const collected = formatCollectedEntries(status.collectedData);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {status.isClosed ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-semibold text-[#475569]">
            Call ended
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FEF2F2] px-3 py-1 text-xs font-semibold text-[#B91C1C]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#EF4444]" />
            Live
          </span>
        )}
        <span className="text-sm text-[#64748B]">
          Turn {status.turnCount}
        </span>
        <span className="rounded-full bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-medium text-[#334155]">
          {labelLeadStatus(status.leadStatus)}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Stage</p>
        <StageTimeline stage={status.stage} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Last customer message</p>
          <p className="mt-2 text-sm text-[#334155]">
            {status.lastUserMessage || "Waiting for customer…"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Last agent message</p>
          <p className="mt-2 text-sm text-[#334155]">
            {status.lastAssistantMessage || "Waiting for agent…"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Collected so far</p>
        {collected.length ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {collected.map((entry) => (
              <div
                key={entry.key}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"
              >
                <dt className="text-xs font-medium text-[#64748B]">{entry.key}</dt>
                <dd className="mt-1 font-medium text-[#0F172A]">{entry.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-[#94A3B8]">
            No customer details captured yet. Fields will appear as the agent collects them.
          </p>
        )}
      </div>

      {status.isClosed ? (
        <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Call wrap-up</p>
          {status.objective ? (
            <p className="text-sm text-[#334155]">
              <span className="font-medium text-[#0F172A]">Objective:</span>{" "}
              {formatSnakeCase(status.objective)}
            </p>
          ) : null}
          {status.endReason ? (
            <p className="text-sm text-[#334155]">
              <span className="font-medium text-[#0F172A]">Ended because:</span>{" "}
              {labelEndReason(status.endReason)}
            </p>
          ) : null}
          {status.intentInsight ? (
            <p className="text-sm text-[#334155]">
              <span className="font-medium text-[#0F172A]">Detected intent:</span>{" "}
              {formatIntentInsight(status.intentInsight)}
            </p>
          ) : null}
          {!status.objective && !status.endReason && !status.intentInsight ? (
            <p className="text-sm text-[#94A3B8]">Final call metadata is still syncing.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LiveCallPanel({
  sessionId,
  phoneNumber,
  onEnded,
}: {
  sessionId: string | null;
  phoneNumber?: string;
  onEnded?: (status: LeadOutcomeLive) => void;
}) {
  const { status, error, loading, isWaiting } = useLiveCallPolling(sessionId, { onEnded });

  if (!sessionId) return null;

  return (
    <div className="rounded-2xl border border-[#BFDBFE] bg-[#F8FBFF] p-5 shadow-[0_10px_25px_rgba(37,99,235,0.08)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#0F172A]">
          {phoneNumber ? `Live call — ${phoneNumber}` : "Live call in progress"}
        </h3>
        <p className="text-sm text-[#64748B]">
          Updates every few seconds while the call is active.
        </p>
      </div>

      {error && !status ? (
        <InlineAlert variant="info">
          Waiting for call data… ({error})
        </InlineAlert>
      ) : null}

      {isWaiting || (loading && !status) ? (
        <p className="text-sm text-[#64748B]">Connecting to live call status…</p>
      ) : null}

      {status ? <LiveCallBody status={status} /> : null}
    </div>
  );
}
