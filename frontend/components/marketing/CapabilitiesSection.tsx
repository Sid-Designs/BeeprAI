"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { SpotlightCard } from "@/components/animations/SpotlightCard";
import { gsap, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

const icons: Record<string, ReactNode> = {
  "phone-out": (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  book: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  chart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  building: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  bot: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  shield: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

setupGsap();

const capabilities = [
  {
    title: "Outbound Calling",
    copy: "Run proactive outreach with scripted but natural conversation flows.",
    icon: "phone-out",
  },
  {
    title: "Inbound Calling",
    copy: "Answer incoming calls instantly with business-aware responses.",
    icon: "bot",
  },
  {
    title: "Knowledge Base",
    copy: "Train agents with text, PDFs, and websites in one place.",
    icon: "book",
  },
  {
    title: "Smart Routing",
    copy: "Escalate important conversations to the right human teammate.",
    icon: "building",
  },
  {
    title: "Analytics",
    copy: "Track call outcomes, conversion trends, and team performance.",
    icon: "chart",
  },
  {
    title: "CRM Integrations",
    copy: "Sync conversation outcomes with your existing business systems.",
    icon: "shield",
  },
];

export function CapabilitiesSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-cap]", {
          y: 20,
          opacity: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: gridRef.current, start: "top 85%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: gridRef },
  );

  return (
    <SectionFrame id="capabilities" badge="Capabilities" title="Everything Your Team Needs">
      <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {capabilities.map((cap) => (
          <div key={cap.title} data-cap>
            <SpotlightCard className="group h-full p-6">
              <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition duration-300 group-hover:scale-110 group-hover:bg-[#2563EB] group-hover:text-white">
                {icons[cap.icon]}
              </span>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#0F172A]">{cap.title}</h3>
                <span className="translate-x-0 text-[#94A3B8] transition duration-300 group-hover:translate-x-1 group-hover:text-[#2563EB]">
                  →
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{cap.copy}</p>
            </SpotlightCard>
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
