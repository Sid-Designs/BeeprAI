"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { CounterAnimation } from "@/components/animations/CounterAnimation";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

const icons: Record<string, ReactNode> = {
  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  businesses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  availability: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reliability: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

const stats = [
  { key: "calls", label: "Calls handled", value: 10, suffix: "K+" },
  { key: "businesses", label: "Businesses onboard", value: 500, suffix: "+" },
  { key: "availability", label: "Always available", value: 24, suffix: "/7" },
  { key: "reliability", label: "Uptime reliability", value: 99.9, suffix: "%" },
];

export function StatsBar() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!scope.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".stat-inner", {
          y: 18,
          opacity: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: { trigger: scope.current, start: "top 92%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <section className="mx-auto -mt-2 max-w-7xl px-6 py-10">
      <div
        ref={scope}
        className="grid gap-px overflow-hidden rounded-3xl border border-[#E2E8F0] bg-[#E2E8F0] shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="stat-item group relative bg-white px-6 py-7 transition duration-300 hover:bg-[#F8FAFC]"
          >
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-[#2563EB] to-[#38BDF8] transition-transform duration-300 group-hover:scale-x-100" />
            <div className="stat-inner">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition duration-300 group-hover:scale-110">
                {icons[stat.key]}
              </span>
              <p className="text-3xl font-semibold tracking-[-0.02em] text-[#0F172A]">
                {Number.isInteger(stat.value) ? (
                  <CounterAnimation value={stat.value} suffix={stat.suffix} animateOnScroll />
                ) : (
                  `${stat.value}${stat.suffix}`
                )}
              </p>
              <p className="mt-1.5 text-sm text-[#64748B]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
