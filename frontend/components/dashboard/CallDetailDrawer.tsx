"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Drawer } from "@/components/shared/Drawer";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { api } from "@/lib/api";
import { useCallAnalysisPolling } from "@/hooks/useCallAnalysisPolling";
import {
  analysisStatusTone,
  formatAnalyticsEntries,
  formatCallDuration,
  formatCallLabel,
  formatCollectedEntries,
  formatIntentInsight,
  formatTranscriptTimestamp,
  isAnalysisPending,
  labelAnalysisStatus,
  labelEndReason,
  labelOutcome,
  formatSnakeCase,
} from "@/lib/callDetail";
import type { CallAnalysis, IntentInsight } from "@/lib/types";
import { cn } from "@/lib/cn";

type DetailTab = "overview" | "transcript";

function DetailCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-3", className)}>
      <h4 className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{title}</h4>
      <div className="mt-1.5 text-sm text-[#334155]">{children}</div>
    </section>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const tone = analysisStatusTone(status);
  const classes = {
    neutral: "bg-[#F1F5F9] text-[#475569]",
    info: "bg-[#DBEAFE] text-[#1D4ED8]",
    success: "bg-[#DCFCE7] text-[#15803D]",
    error: "bg-[#FEE2E2] text-[#B91C1C]",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", classes[tone])}>
      {labelAnalysisStatus(status)}
    </span>
  );
}

function EmptyLine({ message }: { message: string }) {
  return <p className="text-sm text-[#94A3B8]">{message}</p>;
}

export function CallDetailContent({ call }: { call: CallAnalysis }) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const pending = isAnalysisPending(call);
  const collected = formatCollectedEntries(call.collectedInformation);
  const objections = Array.isArray(call.objections) ? call.objections.filter(Boolean) : [];
  const metadata = call.metadata && typeof call.metadata === "object" ? call.metadata : {};
  const intentInsight =
    metadata.intentInsight && typeof metadata.intentInsight === "object"
      ? (metadata.intentInsight as Record<string, unknown>)
      : {};
  const analytics =
    metadata.analytics && typeof metadata.analytics === "object"
      ? (metadata.analytics as Record<string, unknown>)
      : {};
  const analyticsEntries = formatAnalyticsEntries(analytics);
  const appointmentId =
    call.appointmentId ||
    (typeof metadata.appointmentId === "string" ? metadata.appointmentId : "") ||
    collected.find((entry) => entry.key === "Appointment Id")?.value ||
    "";
  const secondaryIntents = Array.isArray(call.secondaryIntents)
    ? call.secondaryIntents.filter(Boolean)
    : [];
  const transcript = Array.isArray(call.transcript) ? call.transcript : [];
  const insights = Array.isArray(call.insights) ? call.insights.filter(Boolean) : [];

  const callDate = call.createdAt
    ? new Date(call.createdAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={call.analysisStatus} />
        <span className="text-xs text-[#64748B]">{formatCallDuration(call.duration)}</span>
        {callDate ? <span className="text-xs text-[#94A3B8]">· {callDate}</span> : null}
        {call.leadScore != null ? (
          <span className="text-xs text-[#64748B]">· Score {call.leadScore}</span>
        ) : null}
      </div>

      <div className="flex gap-1 rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-1">
        {(["overview", "transcript"] as DetailTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition",
              tab === key
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#334155]",
            )}
          >
            {key === "overview" ? "Overview" : "Transcript"}
          </button>
        ))}
      </div>

      {pending ? (
        <InlineAlert variant="info">Analysis in progress…</InlineAlert>
      ) : null}

      {call.analysisStatus === "failed" ? (
        <InlineAlert variant="error">Report generation failed.</InlineAlert>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-3">
          <DetailCard title="Outcome">
            <p className="font-medium text-[#0F172A]">{labelOutcome(call.outcome)}</p>
            <p className="mt-1 text-xs text-[#64748B]">{labelEndReason(call.endReason)}</p>
          </DetailCard>

          <DetailCard title="Summary">
            {call.summary ? (
              <p className="leading-relaxed">{call.summary}</p>
            ) : (
              <EmptyLine message={pending ? "Summary loading…" : "No summary."} />
            )}
          </DetailCard>

          {insights.length ? (
            <DetailCard title="Highlights">
              <ul className="list-disc space-y-1 pl-4 text-xs">
                {insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </DetailCard>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailCard title="Intent">
              <p className="font-medium text-[#0F172A]">
                {call.primaryIntent ? formatSnakeCase(call.primaryIntent) : "Unknown"}
              </p>
              {secondaryIntents.length ? (
                <p className="mt-1 text-xs text-[#64748B]">
                  {secondaryIntents.map((i) => formatSnakeCase(i)).join(", ")}
                </p>
              ) : null}
            </DetailCard>
            <DetailCard title="Sentiment">
              <p>{call.sentiment ? formatSnakeCase(call.sentiment) : "Not assessed"}</p>
            </DetailCard>
          </div>

          {objections.length ? (
            <DetailCard title="Objections">
              <ul className="list-disc space-y-1 pl-4 text-xs">
                {objections.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </DetailCard>
          ) : null}

          {collected.length ? (
            <DetailCard title="Data collected">
              <dl className="space-y-1">
                {collected.map((entry) => (
                  <div key={entry.key} className="flex justify-between gap-2 text-xs">
                    <dt className="text-[#64748B]">{entry.key}</dt>
                    <dd className="font-medium text-[#0F172A]">{entry.value}</dd>
                  </div>
                ))}
              </dl>
            </DetailCard>
          ) : null}

          {call.appointmentBooked || call.appointmentDate || appointmentId ? (
            <DetailCard title="Appointment">
              <p className="text-xs">
                {call.appointmentBooked ? "Booked" : "Requested"}
                {call.appointmentDate || call.appointmentTime
                  ? ` · ${[call.appointmentDate, call.appointmentTime].filter(Boolean).join(" at ")}`
                  : ""}
              </p>
              {appointmentId ? (
                <Link
                  href={`/dashboard/calendar?appointment=${encodeURIComponent(appointmentId)}`}
                  className="mt-1 inline-block text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  View in calendar
                </Link>
              ) : null}
            </DetailCard>
          ) : null}

          {call.nextAction ? (
            <DetailCard title="Next step">
              <p className="text-xs">{call.nextAction}</p>
            </DetailCard>
          ) : null}

          <details className="rounded-lg border border-[#EEF2F7] bg-white p-3 text-xs text-[#64748B]">
            <summary className="cursor-pointer font-semibold uppercase tracking-wide text-[#94A3B8]">
              Technical
            </summary>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt>Source</dt>
                <dd>{call.analysisSource || "—"}</dd>
              </div>
              {Object.keys(intentInsight).length ? (
                <div>
                  <dt>Insight</dt>
                  <dd>{formatIntentInsight(intentInsight as IntentInsight)}</dd>
                </div>
              ) : null}
              {analyticsEntries.length ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {analyticsEntries.map((entry) => (
                    <span key={entry.label} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px]">
                      {entry.label}: {entry.value}
                    </span>
                  ))}
                </div>
              ) : null}
            </dl>
          </details>
        </div>
      ) : (
        <DetailCard title="Conversation" className="!p-2">
          {transcript.length ? (
            <div className="space-y-2">
              {transcript.map((turn, index) => (
                <div
                  key={`${turn.turnIndex ?? index}-${turn.timestamp}`}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-xs",
                    turn.speaker === "user" ? "bg-white" : "bg-[#EFF6FF]",
                  )}
                >
                  <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase text-[#94A3B8]">
                    <span>{turn.speaker === "user" ? "Customer" : "Agent"}</span>
                    {formatTranscriptTimestamp(turn.timestamp) ? (
                      <span>{formatTranscriptTimestamp(turn.timestamp)}</span>
                    ) : null}
                  </div>
                  <p>{turn.message || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine message={pending ? "Transcript loading…" : "No transcript."} />
          )}
        </DetailCard>
      )}
    </div>
  );
}

export function CallDetailPanel({
  call,
  loading,
  error,
  onClose,
  embedded = false,
  className,
}: {
  call: CallAnalysis | null;
  loading?: boolean;
  error?: string;
  onClose?: () => void;
  embedded?: boolean;
  className?: string;
}) {
  const title = formatCallLabel(call);

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        !embedded && "min-h-[320px] rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_20px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#F1F5F9] px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Call details
          </p>
          <h3 className="truncate text-sm font-semibold text-[#0F172A]">{title}</h3>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9]"
          >
            Close
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading && !call ? <p className="text-sm text-[#64748B]">Loading…</p> : null}
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        {call ? <CallDetailContent call={call} /> : null}
        {!loading && !error && !call ? (
          <EmptyLine message="Pick a call from the list." />
        ) : null}
      </div>
    </div>
  );
}

export function CallDetailDrawer({
  sessionId,
  preview,
  open,
  onClose,
}: {
  sessionId: string | null;
  preview?: CallAnalysis | null;
  open: boolean;
  onClose: () => void;
}) {
  const [call, setCall] = useState<CallAnalysis | null>(preview ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCallUpdate = useCallback((next: CallAnalysis) => {
    setCall(next);
  }, []);

  useCallAnalysisPolling(sessionId, call, handleCallUpdate, open);

  useEffect(() => {
    if (!open || !sessionId) return;
    if (preview) setCall(preview);
    setError("");
    setLoading(true);
    api
      .getCallAnalysis(sessionId)
      .then((response) => setCall(response.data))
      .catch((err: Error) => setError(err.message || "Failed to load call details"))
      .finally(() => setLoading(false));
  }, [open, sessionId, preview]);

  const title = call ? `Call · ${formatCallLabel(call)}` : "Call details";

  return (
    <Drawer open={open} onClose={onClose} title={title}>
      {loading && !call ? <p className="text-sm text-[#64748B]">Loading…</p> : null}
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {call ? <CallDetailContent call={call} /> : null}
    </Drawer>
  );
}
