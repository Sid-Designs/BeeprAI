"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Select, Label } from "@/components/shared/FormField";
import type { Agent, KbGapClusterReport } from "@/lib/types";

export function KbGapsPanel() {
  const tenantId = getTenantId() ?? "";
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [report, setReport] = useState<KbGapClusterReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    api
      .listAgents(tenantId)
      .then((response) => {
        setAgents(response.data ?? []);
      })
      .catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    setLoading(true);
    setError("");

    api
      .getKbGapClusters(tenantId, {
        agentId: agentId || undefined,
        windowHours: 24,
      })
      .then((response) => {
        setReport(response.data);
      })
      .catch((err: Error) => {
        setReport(null);
        setError(err.message || "Failed to load knowledge gaps");
      })
      .finally(() => setLoading(false));
  }, [tenantId, agentId]);

  return (
    <DashboardPanel
      title="Knowledge gaps"
      description="Repeated caller questions where the agent lacked KB coverage in the last 24 hours."
    >
      <div className="mb-4 max-w-xs">
        <Label htmlFor="kb-gap-agent">Filter by agent</Label>
        <Select
          id="kb-gap-agent"
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
        >
          <option value="">All agents</option>
          {agents.map((agent) => (
            <option key={agent._id} value={agent._id}>
              {agent.name}
            </option>
          ))}
        </Select>
      </div>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      {loading && !report ? (
        <p className="text-sm text-[#64748B]">Loading knowledge gap clusters…</p>
      ) : null}

      {report && !loading ? (
        <div className="space-y-5">
          <p className="text-xs text-[#64748B]">
            {report.totalSignals} signal{report.totalSignals === 1 ? "" : "s"} across{" "}
            {report.clusterCount} topic{report.clusterCount === 1 ? "" : "s"} · last{" "}
            {report.windowHours}h
            {report.generatedAt
              ? ` · updated ${new Date(report.generatedAt).toLocaleString()}`
              : ""}
          </p>

          {report.clusterCount === 0 ? (
            <p className="text-sm text-[#64748B]">
              No KB gap signals detected recently. Gaps appear when callers ask questions the
              knowledge base could not answer confidently.{" "}
              <Link href="/dashboard/knowledge" className="font-semibold text-[#2563EB] hover:underline">
                Manage knowledge
              </Link>
            </p>
          ) : (
            <>
              {report.recommendations.length ? (
                <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#1D4ED8]">
                    Top recommendations
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-[#334155]">
                    {report.recommendations.map((item) => (
                      <li key={`${item.topic}-${item.action}`}>
                        <span className="font-medium text-[#0F172A]">{item.topic}</span>
                        {" — "}
                        {item.action}
                        <span className="text-[#64748B]"> ({item.signalCount} signals)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-3">
                {report.clusters.map((cluster) => (
                  <article
                    key={cluster.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[#0F172A]">{cluster.label}</h4>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-[#475569]">
                        {cluster.signalCount} signal{cluster.signalCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#334155]">{cluster.recommendedAction}</p>
                    <dl className="mt-3 grid gap-2 text-xs text-[#64748B] sm:grid-cols-3">
                      <div>
                        <dt>KB gate hits</dt>
                        <dd className="font-semibold text-[#0F172A]">{cluster.kbGateCount}</dd>
                      </div>
                      <div>
                        <dt>Abandoned</dt>
                        <dd className="font-semibold text-[#0F172A]">{cluster.abandonedCount}</dd>
                      </div>
                      <div>
                        <dt>Unanswered</dt>
                        <dd className="font-semibold text-[#0F172A]">{cluster.unansweredCount}</dd>
                      </div>
                    </dl>
                    {cluster.sampleQueries.length ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
                          Sample questions
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                          {cluster.sampleQueries.map((query) => (
                            <li key={query}>{query}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </DashboardPanel>
  );
}
