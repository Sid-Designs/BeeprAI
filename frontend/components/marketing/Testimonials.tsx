"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

setupGsap();

const items = [
  {
    quote: "Beepr now handles 80% of our inbound calls automatically.",
    name: "Nina Reed",
    role: "Revenue Ops",
    company: "Apex Health",
    result: "41% faster lead response",
  },
  {
    quote: "Support queues dropped after we launched voice automation in one week.",
    name: "Harsh Mehta",
    role: "Customer Success Lead",
    company: "Pearl Clinics",
    result: "18 hrs/week saved",
  },
  {
    quote: "The onboarding flow made our first production agent go live in minutes.",
    name: "Sophia Lin",
    role: "Growth Lead",
    company: "Northway",
    result: "2.3x conversion lift",
  },
];

export function Testimonials() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const viewport = viewportRef.current;
      const list = listRef.current;
      if (!viewport || !list) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const firstSetWidth = list.scrollWidth / 2;
        gsap.set(list, { x: 0 });
        gsap.to(list, {
          x: -firstSetWidth,
          repeat: -1,
          duration: 26,
          ease: "none",
        });
      });
      return () => mm.revert();
    },
    { scope: viewportRef },
  );

  return (
    <SectionFrame align="center" badge="Testimonials" title="Results From Real Teams" className="overflow-hidden">
      <div ref={viewportRef} className="overflow-hidden">
        <div ref={listRef} className="flex w-max gap-5 px-6">
          {[...items, ...items].map((item, idx) => (
            <Card key={`${item.name}-${idx}`} className="w-[420px] p-7">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-sm font-semibold text-[#2563EB]">
                  {item.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A]">{item.name}</p>
                  <p className="text-xs text-[#64748B]">
                    {item.role}, {item.company}
                  </p>
                </div>
              </div>
              <div className="mb-3 flex gap-0.5 text-[#FBBF24]">
                {Array.from({ length: 5 }).map((_, star) => (
                  <svg key={star} viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.78l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L10 1.5z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-[#334155]">&ldquo;{item.quote}&rdquo;</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB]">{item.result}</p>
            </Card>
          ))}
        </div>
      </div>
    </SectionFrame>
  );
}
