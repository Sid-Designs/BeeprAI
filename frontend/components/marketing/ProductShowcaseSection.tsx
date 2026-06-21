"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, setupGsap } from "@/lib/gsap";
import { SectionFrame } from "@/components/marketing/SectionFrame";

setupGsap();

const productViews = [
  {
    title: "Operations Dashboard",
    subtitle: "Track call volume, success rate, and response quality in real time.",
    bars: [22, 48, 36, 58, 42, 66, 72],
  },
  {
    title: "Knowledge Base",
    subtitle: "Manage documents, website sources, and readiness status by agent.",
    bars: [64, 48, 72, 58, 44, 52, 68],
  },
  {
    title: "Call Analytics",
    subtitle: "Review outcomes, transcripts, and conversion performance across teams.",
    bars: [42, 54, 39, 66, 61, 73, 57],
  },
  {
    title: "Agent Builder",
    subtitle: "Configure role, voice, and tone for every AI voice workflow.",
    bars: [35, 52, 45, 59, 70, 62, 76],
  },
];

function MockLaptop({
  title,
  subtitle,
  bars,
}: {
  title: string;
  subtitle: string;
  bars: number[];
}) {
  return (
    <Card hover className="h-full overflow-hidden rounded-3xl border-[#CBD5E1] p-0 shadow-[0_28px_45px_rgba(15,23,42,0.12)]">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FCA5A5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FDE68A]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#86EFAC]" />
        </div>
      </div>
      <div className="bg-white p-5">
        <p className="text-base font-semibold text-[#0F172A]">{title}</p>
        <p className="mt-1 text-sm text-[#64748B]">{subtitle}</p>
        <div className="mt-5 flex h-40 items-end gap-2 rounded-2xl bg-[#F8FAFC] px-4 py-3">
          {bars.map((bar, idx) => (
            <span
              key={`${title}-${idx}`}
              className="product-bar flex-1 rounded-t-md bg-gradient-to-t from-[#2563EB] to-[#60A5FA]"
              style={{ height: `${bar}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ProductShowcaseSection() {
  const scopeRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!scopeRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".product-panel", {
          y: 36,
          opacity: 0,
          duration: 0.7,
          stagger: 0.12,
          ease: "power3.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: scopeRef.current,
            start: "top 85%",
            once: true,
          },
        });
        gsap.from(".product-bar", {
          scaleY: 0,
          transformOrigin: "bottom",
          duration: 0.8,
          stagger: 0.03,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: {
            trigger: scopeRef.current,
            start: "top 80%",
            once: true,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: scopeRef },
  );

  return (
    <SectionFrame
      id="product"
      align="center"
      badge="See Beepr In Action"
      title="Product Experiences Built for Teams"
      subtitle="Visualize exactly how Beepr helps your business create agents, train knowledge, manage calls, and scale communication."
    >
      <div ref={scopeRef} className="grid gap-6 lg:grid-cols-2">
        {productViews.map((view) => (
          <div key={view.title} className="product-panel">
            <MockLaptop title={view.title} subtitle={view.subtitle} bars={view.bars} />
          </div>
        ))}
      </div>
    </SectionFrame>
  );
}
