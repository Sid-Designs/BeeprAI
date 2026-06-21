"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { AnalyticsChart } from "@/components/dashboard/AnalyticsChart";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { KbGapsPanel } from "@/components/dashboard/KbGapsPanel";
import { Card } from "@/components/shared/Card";
import { InlineAlert } from "@/components/shared/InlineAlert";
import type { TenantAnalyticsSummary } from "@/lib/types";

function formatDuration(seconds: number) {
  if (seconds <= 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function AnalyticsPanel() {
  const tenantId = getTenantId();
  const [summary, setSummary] = useState<TenantAnalyticsSummary | null>(null);
  const [error, setError] = useState(tenantId ? "" : "No workspace session available.");

  useEffect(() => {
    if (!tenantId) return;
    api
      .getTenantAnalytics(tenantId)
      .then((response) => {
        setSummary(response.data);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [tenantId]);

  if (error) {
    return <InlineAlert variant="error">{error}</InlineAlert>;
  }

  if (!summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
        ))}
      </div>
    );
  }

  const metrics = [
    {
      label: "Conversion rate",
      value: `${summary.conversionRate}%`,
      trend: `${summary.totalCalls} calls (7 days)`,
    },
    {
      label: "Avg. call duration",
      value: formatDuration(summary.avgCallDurationSeconds),
      trend: "Your workspace",
    },
    {
      label: "Top performer",
      value: summary.topPerformer?.name ?? "—",
      trend: summary.topPerformer ? `${summary.topPerformer.calls} calls` : "No calls yet",
    },
    {
      label: "Knowledge sources",
      value: String(summary.knowledgeSourceCount),
      trend: "In this workspace",
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-xs text-[#64748B]">
        Showing analytics for your workspace only — last {summary.periodDays} days.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} hover className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
              {metric.value}
            </p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">{metric.trend}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <AnalyticsChart
          barHeights={summary.dailyBarHeights}
          dailyVolume={summary.dailyVolume}
          totalCalls={summary.totalCalls}
        />
        <DashboardPanel
          title="Performance snapshot"
          description={
            summary.totalCalls === 0
              ? "No call activity yet in your workspace."
              : "Highlights from your workspace call activity."
          }
        >
          {summary.totalCalls === 0 ? (
            <p className="text-sm text-[#64748B]">
              Metrics will populate after your first completed call.{" "}
              <Link href="/dashboard/calls" className="font-semibold text-[#2563EB] hover:underline">
                Start a call
              </Link>
            </p>
          ) : null}
          <ul className="space-y-3 text-sm text-[#334155]">
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#64748B]">Calls today</span>
              <span className="font-semibold text-[#0F172A]">{summary.callsToday}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#64748B]">Success rate</span>
              <span className="font-semibold text-[#0F172A]">{summary.successRate}%</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#64748B]">Active agents</span>
              <span className="font-semibold text-[#0F172A]">{summary.activeAgents}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-[#64748B]">Total calls (7d)</span>
              <span className="font-semibold text-[#0F172A]">{summary.totalCalls}</span>
            </li>
          </ul>
        </DashboardPanel>
      </div>

      <KbGapsPanel />
    </div>
  );
}
