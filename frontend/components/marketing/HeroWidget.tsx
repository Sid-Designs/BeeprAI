"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";
import { Card } from "@/components/shared/Card";

setupGsap();

const transcriptLoop = [
  {
    customer: "Can I reschedule my appointment?",
    agent: "Absolutely. What date works best for you?",
  },
  {
    customer: "Do you have availability this Friday afternoon?",
    agent: "Yes. I can lock 3:30 PM and send confirmation now.",
  },
  {
    customer: "Can you text me the details too?",
    agent: "Done. You will receive a message in under a minute.",
  },
];

export function HeroWidget() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const customerRef = useRef<HTMLParagraphElement>(null);
  const aiRef = useRef<HTMLParagraphElement>(null);
  const cycleTimerRef = useRef<number | null>(null);
  const [loopIndex, setLoopIndex] = useState(0);
  const [customerText, setCustomerText] = useState(transcriptLoop[0].customer);
  const [agentText, setAgentText] = useState("");
  const [agentVisible, setAgentVisible] = useState(false);
  const [statusText, setStatusText] = useState("Listening");
  const [seconds, setSeconds] = useState(12);
  const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(".hero-wave-bar", {
          scaleY: () => gsap.utils.random(0.35, 1.1),
          stagger: {
            each: 0.05,
            repeat: -1,
            yoyo: true,
          },
          duration: 0.5,
          ease: "sine.inOut",
        });
      });
      return () => mm.revert();
    },
    { scope: widgetRef },
  );

  useGSAP(
    () => {
      if (!customerRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.fromTo(
          customerRef.current,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: "power2.out",
          },
        );
      });
      return () => mm.revert();
    },
    { dependencies: [customerText], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      if (!aiRef.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!agentVisible) {
          gsap.set(aiRef.current, { opacity: 0, y: 6 });
          return;
        }
        gsap.fromTo(
          aiRef.current,
          { opacity: 0, y: 10 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: "power2.out",
          },
        );
      });
      return () => mm.revert();
    },
    { dependencies: [agentVisible, agentText], revertOnUpdate: true },
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const clearCycleTimer = () => {
      if (cycleTimerRef.current !== null) {
        window.clearTimeout(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
    };

    const runCycle = (index: number) => {
      const active = transcriptLoop[index];
      setCustomerText(active.customer);
      setAgentVisible(false);
      setAgentText("");
      setStatusText("Listening");

      cycleTimerRef.current = window.setTimeout(() => {
        setAgentText(active.agent);
        setAgentVisible(true);
        setStatusText("Responding");

        cycleTimerRef.current = window.setTimeout(() => {
          setStatusText("Call active");
          cycleTimerRef.current = window.setTimeout(() => {
            setLoopIndex((prev) => (prev + 1) % transcriptLoop.length);
          }, 1000);
        }, 1900);
      }, 900);
    };

    runCycle(loopIndex);
    return clearCycleTimer;
  }, [loopIndex]);

  useEffect(() => {
    return () => {
      if (cycleTimerRef.current !== null) {
        window.clearTimeout(cycleTimerRef.current);
      }
    };
  }, []);

  const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
  const second = String(seconds % 60).padStart(2, "0");

  return (
    <div ref={widgetRef} className="w-full max-w-[520px] lg:w-[520px]">
      <Card className="overflow-hidden border-[#DBEAFE] bg-white p-0 shadow-[0_30px_60px_rgba(15,23,42,0.14)]">
        <div className="flex items-center justify-between border-b border-[#EEF2F7] bg-gradient-to-r from-[#F8FAFC] to-white px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-[#2563EB] opacity-30" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="relative h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">Live Call Simulation</p>
              <p className="text-sm font-semibold text-[#0F172A]">Active conversation</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEF2F2] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#EF4444]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
              </span>
              Live
            </span>
            <span className="text-sm font-semibold tabular-nums text-[#2563EB]">
              {minute}:{second}
            </span>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex h-16 items-center justify-center gap-[3px] rounded-2xl bg-[#F8FAFC] px-4">
            {bars.map((bar) => (
              <span
                key={bar}
                className="hero-wave-bar h-9 w-[3px] origin-center rounded-full bg-gradient-to-t from-[#2563EB] to-[#60A5FA]"
              />
            ))}
          </div>

          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#F1F5F9] text-xs font-semibold text-[#64748B]">
              C
            </span>
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-[#F1F5F9] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Customer</p>
              <p ref={customerRef} className="mt-1 min-h-[24px] text-sm leading-6 text-[#334155]">
                {customerText}
              </p>
            </div>
          </div>

          <div className="flex flex-row-reverse items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1 rounded-2xl rounded-tr-sm border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563EB]">Beepr AI</p>
              <p ref={aiRef} className="mt-1 min-h-[24px] text-sm leading-6 text-[#1E3A8A]">
                {agentVisible ? agentText : ""}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                {statusText}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 border-t border-[#EEF2F7] bg-[#F8FAFC] px-5 py-3.5">
          <button
            type="button"
            aria-label="Mute"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#475569] shadow-sm transition hover:-translate-y-0.5 hover:text-[#2563EB]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1.5a3 3 0 00-3 3v6a3 3 0 006 0v-6a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5a7 7 0 0014 0M12 17.5V21" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="End call"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#EF4444] text-white shadow-[0_10px_20px_rgba(239,68,68,0.35)] transition hover:-translate-y-0.5 hover:bg-[#DC2626]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 rotate-[135deg]">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Speaker"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#475569] shadow-sm transition hover:-translate-y-0.5 hover:text-[#2563EB]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
            </svg>
          </button>
        </div>
      </Card>
    </div>
  );
}
