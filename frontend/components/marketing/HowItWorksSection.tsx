"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

setupGsap();

const steps = [
  { id: "01", title: "Create Agent", body: "Define the role, voice, and tone your AI should use." },
  { id: "02", title: "Train Knowledge", body: "Upload text, PDFs, and website sources in one unified workspace." },
  { id: "03", title: "Connect Number", body: "Use your business line for inbound and outbound calling flows." },
  { id: "04", title: "Start Calling", body: "Launch campaigns and monitor outcomes from your dashboard." },
];

export function HowItWorksSection() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!scope.current) return;
      const cards = gsap.utils.toArray<HTMLElement>(".timeline-step");

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(cards, { opacity: 1, x: 0 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(cards, { opacity: 0, x: 32 });
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              x: 0,
              stagger: 0.14,
              duration: 0.6,
              ease: "power2.out",
              overwrite: true,
            }),
        });
        ScrollTrigger.refresh();
      });
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <SectionFrame id="how-it-works" badge="How It Works" title="From Setup to Live Calls">
      <div ref={scope} className="relative grid gap-4 lg:grid-cols-4">
        <div className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-[#DBEAFE] via-[#BFDBFE] to-[#DBEAFE] lg:block" />
        {steps.map((step, index) => (
          <Card key={step.id} hover className="timeline-step group relative p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.3)] transition duration-300 group-hover:scale-110">
                {step.id}
              </span>
              {index !== steps.length - 1 ? (
                <span className="hidden flex-1 text-right text-lg text-[#CBD5E1] transition group-hover:text-[#2563EB] lg:block">
                  →
                </span>
              ) : null}
            </div>
            <h3 className="text-lg font-semibold text-[#0F172A]">{step.title}</h3>
            <p className="mt-2 text-sm text-[#64748B]">{step.body}</p>
          </Card>
        ))}
      </div>
    </SectionFrame>
  );
}
