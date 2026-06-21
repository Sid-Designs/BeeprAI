"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import {
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  getServerTenantIdSnapshot,
  getTenantIdSnapshot,
  subscribeAuthSession,
  subscribeTenantId,
} from "@/lib/auth";
import { CounterAnimation } from "@/components/animations/CounterAnimation";
import { Card } from "@/components/shared/Card";
import { StatCard } from "@/components/dashboard/StatCard";
import { WorkspaceSetup } from "@/components/dashboard/WorkspaceSetup";
import type { Tenant, TenantAnalyticsSummary, TenantUsage } from "@/lib/types";

const quickActions = [
  {
    href: "/dashboard/agents",
    title: "Create an agent",
    desc: "Configure a new AI voice agent.",
    accent: "from-[#2563EB] to-[#38BDF8]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a6 6 0 016-6h6a6 6 0 016 6v1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/knowledge",
    title: "Upload knowledge",
    desc: "Train agents on your docs & FAQs.",
    accent: "from-[#6366F1] to-[#818CF8]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calls",
    title: "Start a call",
    desc: "Launch an outbound AI voice call.",
    accent: "from-[#0EA5E9] to-[#22D3EE]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.68l1.2 3.6a1 1 0 01-.5 1.2L7.5 9.6a12 12 0 006.9 6.9l1.12-1.75a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.6 21 3 14.4 3 6V5z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/analytics",
    title: "View analytics",
    desc: "Track outcomes and performance.",
    accent: "from-[#10B981] to-[#34D399]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6" />
      </svg>
    ),
  },
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Hydration-safe "mounted" flag without a setState-in-effect.
const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

const icons = {
  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.68l1.2 3.6a1 1 0 01-.5 1.2L7.5 9.6a12 12 0 006.9 6.9l1.12-1.75a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.6 21 3 14.4 3 6V5z" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5l2 2 4-4.5M12 3a9 9 0 100 18 9 9 0 000-18z" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a6 6 0 016-6h6a6 6 0 016 6v1" />
    </svg>
  ),
  knowledge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
    </svg>
  ),
};

export function OverviewPanel() {
  const session = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );
  const firstName = session?.fullName?.trim().split(/\s+/)[0] ?? "there";
  const mounted = useSyncExternalStore(subscribeNoop, getMountedSnapshot, getServerMountedSnapshot);
  const tenantId = useSyncExternalStore(
    subscribeTenantId,
    getTenantIdSnapshot,
    getServerTenantIdSnapshot,
  );
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [analytics, setAnalytics] = useState<TenantAnalyticsSummary | null>(null);
  const [platformNumber, setPlatformNumber] = useState("—");
  // A workspace is unusable if the stored id is stale/invalid (the legacy
  // "tenant_demo" case) and fails to load.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    api
      .getTenant(tenantId)
      .then((response) => {
        if (cancelled) return;
        setTenant(response.data);
        setUsage(response.usage ?? null);
        setPlatformNumber(response.telephony?.defaultCallerNumber || "Not configured");
        setLoadFailed(false);
      })
      .catch(() => {
        // Treat an unusable workspace id as "needs setup" rather than erroring.
        if (!cancelled) setLoadFailed(true);
      });

    api
      .getTenantAnalytics(tenantId)
      .then((response) => {
        if (!cancelled) setAnalytics(response.data);
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (!mounted) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
        ))}
      </div>
    );
  }

  const needsSetup = !tenantId || loadFailed;

  if (needsSetup) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] via-white to-[#F5F3FF] p-6 shadow-[0_10px_30px_rgba(37,99,235,0.06)]">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#BFDBFE] opacity-40 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">{greeting()}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
              Welcome to Beepr, {firstName}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Let&apos;s set up your workspace so you can launch your first AI voice agent.
            </p>
          </div>
        </div>

        <WorkspaceSetup onComplete={() => setLoadFailed(false)} />
      </div>
    );
  }

  const callsUsed = usage?.usage?.callsUsed ?? 0;
  const callsMax = usage?.usageLimits?.maxCallsPerMonth ?? 0;
  const agentsUsed = usage?.usage?.agentsUsed ?? 0;
  const agentsMax = usage?.usageLimits?.maxAgents ?? 0;
  const callsPct = callsMax > 0 ? Math.min(100, Math.round((callsUsed / callsMax) * 100)) : 0;
  const agentsPct = agentsMax > 0 ? Math.min(100, Math.round((agentsUsed / agentsMax) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] via-white to-[#F5F3FF] p-6 shadow-[0_10px_30px_rgba(37,99,235,0.06)]">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#BFDBFE] opacity-40 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">{greeting()}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#0F172A]">
              Welcome back, {firstName}
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Here&apos;s what&apos;s happening across {tenant?.orgName ?? "your workspace"} today.
            </p>
          </div>
          <Link
            href="/dashboard/calls"
            className="shine inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#38BDF8] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.3)] transition hover:shadow-[0_14px_28px_rgba(37,99,235,0.4)]"
          >
            Start a call
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Calls Today"
          value={<CounterAnimation value={analytics?.callsToday ?? 0} />}
          icon={icons.calls}
          subtitle="Your workspace"
        />
        <StatCard
          title="Success Rate"
          value={<CounterAnimation value={analytics?.successRate ?? 0} suffix="%" />}
          icon={icons.success}
          subtitle="Last 7 days"
        />
        <StatCard
          title="Active Agents"
          value={<CounterAnimation value={agentsUsed} />}
          icon={icons.agents}
          subtitle="In production"
        />
        <StatCard
          title="Knowledge Sources"
          value={<CounterAnimation value={analytics?.knowledgeSourceCount ?? 0} />}
          icon={icons.knowledge}
          subtitle="Your workspace"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[#0F172A]">Quick actions</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-[0_14px_30px_rgba(37,99,235,0.12)]"
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.accent} text-white shadow-[0_6px_14px_rgba(37,99,235,0.25)]`}
              >
                {action.icon}
              </span>
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold text-[#0F172A]">
                  {action.title}
                  <span
                    aria-hidden
                    className="text-[#94A3B8] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[#2563EB]"
                  >
                    →
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-[#64748B]">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-base font-bold text-white">
              {(tenant?.orgName ?? "W").charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="text-lg font-semibold text-[#0F172A]">{tenant?.orgName ?? "Workspace"}</p>
              <p className="text-sm text-[#64748B]">{tenant?.industry ?? "Industry not set"}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#EEF2F7] pt-5">
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[#94A3B8]">Plan</p>
              <p className="mt-1 text-sm font-semibold capitalize text-[#0F172A]">{tenant?.plan ?? "free"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.1em] text-[#94A3B8]">Business Number</p>
              <p className="mt-1 text-sm font-semibold text-[#0F172A]">{platformNumber}</p>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-lg font-semibold text-[#0F172A]">Usage This Month</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Calls</span>
                <span className="font-semibold text-[#0F172A]">
                  {callsUsed} / {usage?.usageLimits?.maxCallsPerMonth ?? "—"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8] transition-all duration-700"
                  style={{ width: `${callsPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Agents</span>
                <span className="font-semibold text-[#0F172A]">
                  {agentsUsed} / {usage?.usageLimits?.maxAgents ?? "—"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#818CF8] transition-all duration-700"
                  style={{ width: `${agentsPct}%` }}
                />
              </div>
            </div>
            <p className="border-t border-[#EEF2F7] pt-3 text-sm text-[#64748B]">
              Calls remaining: <span className="font-semibold text-[#0F172A]">{usage?.callsRemaining ?? "—"}</span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
