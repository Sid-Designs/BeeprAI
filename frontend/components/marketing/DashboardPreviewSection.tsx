"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

setupGsap();

const moduleIcons: Record<string, ReactNode> = {
  analytics: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  logs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  knowledge: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  performance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
};

const modules = [
  { key: "analytics", title: "Analytics dashboard", desc: "Track every call and conversion trend in one place." },
  { key: "logs", title: "Call logs", desc: "Review outcomes, durations, and customer history instantly." },
  { key: "knowledge", title: "Knowledge management", desc: "Upload, monitor, and optimize source quality for every agent." },
  { key: "performance", title: "Agent performance", desc: "Compare response quality and business impact by agent." },
];

const kpis = [
  { label: "Call volume", value: "3,284", trend: "+12.4%", up: true },
  { label: "Success rate", value: "92%", trend: "+3.1%", up: true },
  { label: "Avg. handle time", value: "1m 48s", trend: "-9s", up: true },
  { label: "Knowledge health", value: "98%", trend: "+1.2%", up: true },
];

const chart = [
  { day: "Mon", value: 46 },
  { day: "Tue", value: 62 },
  { day: "Wed", value: 54 },
  { day: "Thu", value: 78 },
  { day: "Fri", value: 68 },
  { day: "Sat", value: 88 },
  { day: "Sun", value: 72 },
];

const recentCalls = [
  { name: "Inbound · Booking", meta: "Resolved in 1m 32s", tag: "Booked", tone: "good", initials: "AB" },
  { name: "Outbound · Reminder", meta: "Confirmed appointment", tag: "Success", tone: "good", initials: "RK" },
  { name: "Inbound · Support", meta: "Escalated to human rep", tag: "Routed", tone: "warn", initials: "MS" },
];

export function DashboardPreviewSection() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!scopeRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".dashboard-mock", {
          y: 24,
          opacity: 0,
          duration: 0.7,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: scopeRef.current, start: "top 85%", once: true },
        });
        gsap.from(".dash-bar", {
          scaleY: 0,
          transformOrigin: "bottom",
          duration: 0.7,
          stagger: 0.06,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: scopeRef.current, start: "top 80%", once: true },
        });
        gsap.from(".dash-row", {
          x: -14,
          opacity: 0,
          duration: 0.4,
          stagger: 0.08,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: scopeRef.current, start: "top 78%", once: true },
        });
        gsap.from(".dashboard-module", {
          x: 18,
          opacity: 0,
          duration: 0.45,
          stagger: 0.09,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: scopeRef.current, start: "top 80%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: scopeRef },
  );

  return (
    <SectionFrame
      badge="Manage Every Conversation From One Place"
      title="Your Command Center for Voice Operations"
      subtitle="A real-time view of call volume, agent performance, and customer outcomes — all from one workspace."
    >
      <div ref={scopeRef} className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="dashboard-mock overflow-hidden rounded-3xl border-[#CBD5E1] p-0 shadow-[0_30px_55px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FCA5A5]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FDE68A]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#86EFAC]" />
            </div>
            <span className="rounded-md bg-white px-3 py-1 text-xs font-medium text-[#94A3B8]">
              app.beepr.ai/overview
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              Live
            </span>
          </div>

          <div className="bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">Operations overview</p>
                <p className="text-xs text-[#94A3B8]">Last 7 days</p>
              </div>
              <div className="flex items-center gap-1.5">
                {["7D", "30D", "QTR"].map((range, idx) => (
                  <span
                    key={range}
                    className={
                      idx === 0
                        ? "rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-semibold text-white"
                        : "rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#64748B]"
                    }
                  >
                    {range}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-[#EEF2F7] bg-[#F8FAFC] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"
                >
                  <p className="text-[11px] uppercase tracking-[0.1em] text-[#94A3B8]">{kpi.label}</p>
                  <p className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-[#0F172A]">{kpi.value}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#059669]">
                    <span>{kpi.up ? "↑" : "↓"}</span>
                    {kpi.trend}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.25fr_1fr]">
              <div className="rounded-2xl border border-[#EEF2F7] bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0F172A]">Call volume</p>
                  <p className="text-xs font-medium text-[#059669]">+18% vs last week</p>
                </div>
                <div className="flex h-28 gap-2">
                  {chart.map((point) => (
                    <div key={point.day} className="flex h-full min-w-0 flex-1 flex-col items-center">
                      <div className="flex w-full flex-1 items-end">
                        <span
                          className="dash-bar w-full rounded-t-md bg-gradient-to-t from-[#2563EB] to-[#60A5FA]"
                          style={{ height: `${Math.max(Math.round((point.value / 100) * 112), 6)}px` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  {chart.map((point) => (
                    <span key={point.day} className="flex-1 text-center text-[10px] font-medium text-[#94A3B8]">
                      {point.day}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#EEF2F7] bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-[#0F172A]">Recent calls</p>
                <div className="space-y-2.5">
                  {recentCalls.map((call) => (
                    <div key={call.name} className="dash-row flex items-center gap-3">
                      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#EFF6FF] text-[11px] font-semibold text-[#2563EB]">
                        {call.initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#0F172A]">{call.name}</p>
                        <p className="truncate text-[11px] text-[#94A3B8]">{call.meta}</p>
                      </div>
                      <span
                        className={
                          call.tone === "good"
                            ? "rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#059669]"
                            : "rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#D97706]"
                        }
                      >
                        {call.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          {modules.map((module) => (
            <Card key={module.title} hover className="dashboard-module group flex flex-1 items-center">
              <div className="flex w-full items-start gap-3">
                <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition duration-300 group-hover:bg-[#2563EB] group-hover:text-white">
                  {moduleIcons[module.key]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-[#0F172A]">{module.title}</p>
                    <span className="text-[#CBD5E1] transition duration-300 group-hover:translate-x-1 group-hover:text-[#2563EB]">
                      →
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#64748B]">{module.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </SectionFrame>
  );
}
