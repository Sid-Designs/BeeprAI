"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

const testimonials = [
  {
    quote:
      "We went from manual admission follow-ups to 200+ AI-qualified calls per month. Beepr paid for itself in the first week.",
    author: "Priya Sharma",
    role: "Head of Admissions, EduNova",
    metric: "+340% lead response rate",
  },
  {
    quote:
      "Our sales team uses Beepr to pre-qualify leads before human reps call back. Post-call summaries are spot-on.",
    author: "Marcus Chen",
    role: "VP Sales, SalesPilot",
    metric: "62% faster qualification",
  },
  {
    quote:
      "One AI agent handles rescheduling and confirmations around the clock. Front desk finally has breathing room.",
    author: "Dr. Ananya Patel",
    role: "Operations, ClinicFlow",
    metric: "18 hrs/week saved",
  },
];

export function SocialProofSection() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-testimonial]", {
          y: 24,
          opacity: 0,
          duration: 0.45,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: gridRef.current, start: "top 82%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: gridRef },
  );

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="mb-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Testimonials</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.025em] text-[#0F172A]">Trusted by Growth Teams</h2>
      </div>
      <div ref={gridRef} className="grid gap-5 md:grid-cols-3 lg:gap-6">
        {testimonials.map((item) => (
          <Card key={item.author} data-testimonial className="flex flex-col p-6 sm:p-7">
            <p className="flex-1 text-sm leading-relaxed text-[#334155]">&ldquo;{item.quote}&rdquo;</p>
            <div className="mt-5 border-t border-[#E2E8F0] pt-5">
              <p className="font-semibold text-[#0F172A]">{item.author}</p>
              <p className="text-xs text-[#64748B]">{item.role}</p>
              <p className="mt-2 text-xs font-semibold text-[#2563EB]">{item.metric}</p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
