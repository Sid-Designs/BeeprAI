"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CallDetailContent } from "@/components/dashboard/CallDetailDrawer";
import { useCallAnalysisPolling } from "@/hooks/useCallAnalysisPolling";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { InlineAlert } from "@/components/shared/InlineAlert";
import {
  formatCallDuration,
  formatCallLabel,
  isAnalysisPending,
  labelAnalysisStatus,
  labelOutcome,
} from "@/lib/callDetail";
import type { CallAnalysis } from "@/lib/types";
import { cn } from "@/lib/cn";

function statusBadgeClass(status?: string): string {
  const key = String(status || "pending").toLowerCase();
  if (key === "completed") return "bg-[#DCFCE7] text-[#15803D]";
  if (key === "failed") return "bg-[#FEE2E2] text-[#B91C1C]";
  if (key === "processing") return "bg-[#DBEAFE] text-[#1D4ED8]";
  return "bg-[#F1F5F9] text-[#475569]";
}

export function CallsHistorySidebar({
  rows,
  selectedSessionId,
  onSelect,
  emptyMessage = "No calls yet.",
  className,
}: {
  rows: CallAnalysis[];
  selectedSessionId: string | null;
  onSelect: (row: CallAnalysis) => void;
  emptyMessage?: string;
  className?: string;
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (new Date(b.createdAt ?? "").getTime() || 0) - (new Date(a.createdAt ?? "").getTime() || 0),
      ),
    [rows],
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0F172A]">Call history</h3>
        <span className="text-xs text-[#64748B]">{sorted.length}</span>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-xs text-[#64748B]">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 max-h-[min(420px,calc(100vh-320px))] space-y-1 overflow-y-auto pr-1">
          {sorted.map((row) => {
            const pending = isAnalysisPending(row);
            const active = selectedSessionId === row.sessionId;
            return (
              <li key={row.sessionId}>
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition",
                    active
                      ? "border-[#BFDBFE] bg-[#EFF6FF]"
                      : "border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[#0F172A]">
                      {formatCallLabel(row)}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#94A3B8]">
                      {formatCallDuration(row.duration)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-[#64748B]">{labelOutcome(row.outcome)}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        statusBadgeClass(row.analysisStatus),
                      )}
                    >
                      {labelAnalysisStatus(row.analysisStatus)}
                    </span>
                  </div>
                  {pending ? <p className="mt-0.5 text-[10px] text-[#2563EB]">Processing…</p> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CallReviewPanel({
  sessionId,
  preview,
  onClear,
}: {
  sessionId: string | null;
  preview: CallAnalysis | null;
  onClear?: () => void;
}) {
  const [call, setCall] = useState<CallAnalysis | null>(preview);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCallUpdate = useCallback((next: CallAnalysis) => {
    setCall(next);
  }, []);

  useCallAnalysisPolling(sessionId, call, handleCallUpdate, Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) {
      setCall(null);
      setError("");
      return;
    }
    if (preview) setCall(preview);
    setError("");
    setLoading(true);
    api
      .getCallAnalysis(sessionId)
      .then((response) => setCall(response.data))
      .catch((err: Error) => setError(err.message || "Failed to load call details"))
      .finally(() => setLoading(false));
  }, [sessionId, preview]);

  if (!sessionId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0F172A]">Select a call to review</p>
        <p className="mt-1 text-xs text-[#64748B]">
          Choose a call from the history list to see outcome, summary, and transcript.
        </p>
      </div>
    );
  }

  return (
    <DashboardPanel
      title={formatCallLabel(call ?? preview)}
      description="Review outcome, summary, and transcript."
      action={
        onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9]"
          >
            Clear
          </button>
        ) : null
      }
      bodyClassName="!pt-4"
    >
      {loading && !call ? <p className="text-sm text-[#64748B]">Loading call details…</p> : null}
      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      {call ? <CallDetailContent call={call} /> : null}
    </DashboardPanel>
  );
}

export function CallsTable({ rows }: { rows: CallAnalysis[] }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<CallAnalysis | null>(null);
  const [skipAutoSelect, setSkipAutoSelect] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);

  const scrollToReview = useCallback(() => {
    requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const openDetail = (row: CallAnalysis) => {
    setSelectedPreview(row);
    setSelectedSessionId(row.sessionId);
    setSkipAutoSelect(false);
    scrollToReview();
  };

  const clearDetail = () => {
    setSelectedSessionId(null);
    setSelectedPreview(null);
    setSkipAutoSelect(true);
  };

  useEffect(() => {
    if (!rows.length) {
      clearDetail();
      setSkipAutoSelect(false);
      return;
    }
    if (skipAutoSelect) {
      if (selectedSessionId && !rows.some((row) => row.sessionId === selectedSessionId)) {
        clearDetail();
      }
      return;
    }
    if (!selectedSessionId || !rows.some((row) => row.sessionId === selectedSessionId)) {
      const first = rows[0];
      setSelectedPreview(first);
      setSelectedSessionId(first.sessionId);
    }
  }, [rows, selectedSessionId, skipAutoSelect]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-6 py-12 text-center">
        <p className="text-sm font-medium text-[#0F172A]">No calls yet</p>
        <p className="mt-1 text-xs text-[#64748B]">Call history will appear here after your first outbound call.</p>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]">
      <CallsHistorySidebar
        rows={rows}
        selectedSessionId={selectedSessionId}
        onSelect={openDetail}
      />
      <div ref={reviewRef} className="scroll-mt-6">
        <CallReviewPanel
          sessionId={selectedSessionId}
          preview={selectedPreview}
          onClear={clearDetail}
        />
      </div>
    </div>
  );
}
