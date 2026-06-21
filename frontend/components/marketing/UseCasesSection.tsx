"use client";

import { useRef, useState, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/cn";
import { gsap, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

type UseCase = {
  title: string;
  description: string;
  points: string[];
  stat: { value: string; label: string };
  icon: ReactNode;
};

const useCases: Record<"sales" | "support" | "bookings" | "reminders", UseCase> = {
  sales: {
    title: "Sales Conversations",
    description: "Qualify inbound interest and trigger instant follow-ups while momentum is highest.",
    points: ["Lead qualification in under 90 seconds", "Context-aware objection handling", "Real-time handoff to human reps"],
    stat: { value: "2.3x", label: "more qualified leads" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  support: {
    title: "Customer Support",
    description: "Resolve frequent customer questions instantly using your business knowledge.",
    points: ["Answers based on your knowledge base", "Consistent policy responses", "Escalation-ready summaries"],
    stat: { value: "80%", label: "tickets auto-resolved" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 10a8 8 0 10-16 0v4a2 2 0 002 2h1v-6H4m14 0v6h1a2 2 0 002-2v-2a8 8 0 00-1-4m-1 8a4 4 0 01-4 4h-2" />
      </svg>
    ),
  },
  bookings: {
    title: "Booking & Scheduling",
    description: "Turn inbound intent into confirmed appointments with natural voice interactions.",
    points: ["Reschedule and confirm automatically", "Calendar-aware responses", "Reduced no-show rates"],
    stat: { value: "−38%", label: "fewer no-shows" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  reminders: {
    title: "Automated Reminders",
    description: "Proactively call customers for reminders, renewals, and follow-up confirmations.",
    points: ["Time-based call automation", "Delivery tracking and call outcomes", "Human fallback when needed"],
    stat: { value: "24/7", label: "outreach coverage" },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
};

const tabs = Object.keys(useCases) as Array<keyof typeof useCases>;

setupGsap();

export function UseCasesSection() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<keyof typeof useCases>("sales");
  const content = useCases[active];

  useGSAP(
    () => {
      if (!scopeRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          ".usecase-content",
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" },
        );
        gsap.fromTo(
          ".usecase-point",
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, duration: 0.35, stagger: 0.06, ease: "power2.out" },
        );
      });
      return () => mm.revert();
    },
    { scope: scopeRef, dependencies: [active], revertOnUpdate: true },
  );

  return (
    <SectionFrame id="use-cases" badge="Use Cases" title="Built for Real Conversations">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-semibold capitalize transition",
              active === tab ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card ref={scopeRef} className="grid gap-8 p-8 lg:grid-cols-2 lg:gap-12">
        <div className="usecase-content flex flex-col">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_10px_22px_rgba(37,99,235,0.3)]">
            {content.icon}
          </span>
          <h3 className="mt-5 text-2xl font-semibold text-[#0F172A]">{content.title}</h3>
          <p className="mt-3 text-[#64748B]">{content.description}</p>
          <div className="mt-auto flex items-center gap-3 pt-6">
            <span className="text-3xl font-semibold tracking-[-0.02em] text-[#2563EB]">{content.stat.value}</span>
            <span className="text-sm text-[#64748B]">{content.stat.label}</span>
          </div>
        </div>
        <ul className="usecase-content space-y-3">
          {content.points.map((point) => (
            <li
              key={point}
              className="usecase-point flex items-center gap-3 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3.5 text-sm font-medium text-[#334155] transition duration-300 hover:border-[#BFDBFE] hover:bg-white"
            >
              <span className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
              {point}
            </li>
          ))}
        </ul>
      </Card>
    </SectionFrame>
  );
}
