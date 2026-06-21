"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

const industries = ["Healthcare", "Real Estate", "Education", "Insurance", "Recruitment", "Hospitality"];

export function TrustBar() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const firstSetWidth = track.scrollWidth / 2;
        gsap.set(track, { x: 0 });
        gsap.to(track, {
          x: -firstSetWidth,
          repeat: -1,
          duration: 20,
          ease: "none",
        });
      });
      return () => mm.revert();
    },
    { scope: viewportRef },
  );

  return (
    <section className="border-y border-[#E2E8F0] bg-[#F8FAFC]">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:gap-10">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
          Trusted by teams across industries
        </p>
        <div ref={viewportRef} className="marquee-fade relative min-w-0 flex-1 overflow-hidden">
          <div ref={trackRef} className="flex w-max items-center">
            {[...industries, ...industries].map((industry, idx) => (
              <span key={`${industry}-${idx}`} className="flex items-center">
                <span className="text-sm font-semibold text-[#64748B]">{industry}</span>
                <span className="mx-7 inline-block h-1 w-1 rounded-full bg-[#CBD5E1]" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
