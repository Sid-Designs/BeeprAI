"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Card } from "@/components/shared/Card";
import type { Agent, CallAnalysis, Tenant, TenantUsage } from "@/lib/types";

export function AdminPlatformPanel() {
  const [tenants, setTenants] = useState<(Tenant & { usageSummary?: TenantUsage })[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<CallAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.adminTenants(), api.adminAgents(), api.adminCalls()])
      .then(([tenantData, agentData, callData]) => {
        if (cancelled) return;
        setTenants(tenantData.data ?? []);
        setAgents(agentData.data ?? []);
        setCalls(callData.data ?? []);
        setError("");
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InlineAlert variant="info">
        Platform admin view — you are seeing data across all tenants, agents, and calls. Regular
        users only see their own workspace.
      </InlineAlert>

      {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total tenants" value={tenants.length} subtitle="Registered workspaces" />
        <StatCard title="Total agents" value={agents.length} subtitle="Across all tenants" />
        <StatCard title="Calls analyzed" value={calls.length} subtitle="Platform-wide" />
      </div>

      <DashboardPanel title="All tenants" description="Every workspace registered on Beepr.">
        <div className="overflow-hidden rounded-xl border border-[#EEF2F7]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] text-xs uppercase tracking-[0.08em] text-[#94A3B8]">
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Industry</th>
                <th className="px-4 py-3 font-semibold">Calls used</th>
                <th className="px-4 py-3 font-semibold">Agents used</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#94A3B8]">
                    No tenants found.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant._id} className="border-t border-[#EEF2F7] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 font-medium text-[#0F172A]">{tenant.orgName}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold capitalize text-[#2563EB]">
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{tenant.industry}</td>
                    <td className="px-4 py-3 text-[#475569]">
                      {tenant.usageSummary?.usage?.callsUsed ?? tenant.usage?.callsUsed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {tenant.usageSummary?.usage?.agentsUsed ?? tenant.usage?.agentsUsed ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardPanel title="All agents" description="Every AI agent on the platform.">
          <div className="space-y-2">
            {agents.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No agents found.</p>
            ) : (
              agents.slice(0, 25).map((agent) => (
                <div
                  key={agent._id}
                  className="flex items-center justify-between rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] px-3 py-2.5 text-sm transition hover:border-[#BFDBFE] hover:bg-white"
                >
                  <span className="font-medium text-[#0F172A]">{agent.name}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold capitalize text-[#64748B]">
                    {agent.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Call analysis" description="Recent analyzed calls across tenants.">
          <div className="space-y-2">
            {calls.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No calls found.</p>
            ) : (
              calls.slice(0, 25).map((call) => (
                <div
                  key={call.sessionId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] px-3 py-2.5 text-sm transition hover:border-[#BFDBFE] hover:bg-white"
                >
                  <span className="truncate font-medium text-[#0F172A]">{call.sessionId}</span>
                  <span className="flex flex-none items-center gap-2 text-xs text-[#64748B]">
                    <span className="capitalize">{call.outcome || "unknown"}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-[#2563EB]">
                      lead {call.leadScore ?? 0}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </DashboardPanel>
      </div>

      <Card className="border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] to-white">
        <p className="text-sm font-semibold text-[#1D4ED8]">Admin access</p>
        <p className="mt-1 text-sm text-[#64748B]">
          This section uses your logged-in owner account and backend JWT — no separate admin
          password. Data is loaded from{" "}
          <code className="rounded bg-white px-1 text-xs">/api/admin/*</code> endpoints.
        </p>
      </Card>
    </div>
  );
}
