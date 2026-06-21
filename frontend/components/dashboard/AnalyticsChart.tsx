"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { Card } from "@/components/shared/Card";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

const CHART_HEIGHT_PX = 160;

function buildBarHeights(
  barHeights: number[] | undefined,
  dailyVolume: { label: string; count: number }[] | undefined,
): number[] {
  if (dailyVolume?.length === 7) {
    const max = Math.max(...dailyVolume.map((day) => day.count), 1);
    return dailyVolume.map((day) => Math.round((day.count / max) * 100));
  }
  if (barHeights?.length === 7) return barHeights;
  return [0, 0, 0, 0, 0, 0, 0];
}

function ChartEmptyState() {
  return (
    <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-gradient-to-b from-[#F8FAFC] to-white px-4 text-center">
      <div
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] text-[#2563EB]"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#334155]">No call data yet</p>
      <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-[#64748B]">
        There haven&apos;t been any calls in your workspace over the last 7 days. Your volume trend
        will appear here once activity starts.
      </p>
      <Link
        href="/dashboard/calls"
        className="mt-3 text-xs font-semibold text-[#2563EB] transition hover:text-[#1D4ED8] hover:underline"
      >
        Start your first call →
      </Link>
    </div>
  );
}

export function AnalyticsChart({
  barHeights,
  dailyVolume,
  totalCalls,
}: {
  barHeights?: number[];
  dailyVolume?: { label: string; count: number }[];
  totalCalls?: number;
}) {
  const barsRef = useRef<HTMLDivElement>(null);
  const heights = useMemo(() => buildBarHeights(barHeights, dailyVolume), [barHeights, dailyVolume]);
  const callTotal =
    totalCalls ?? dailyVolume?.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const isEmpty = callTotal === 0;

  const barPixels = useMemo(
    () =>
      heights.map((pct) => {
        if (pct <= 0) return 0;
        return Math.max(Math.round((pct / 100) * CHART_HEIGHT_PX), 6);
      }),
    [heights],
  );

  useGSAP(
    () => {
      if (!barsRef.current || isEmpty) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".chart-bar", {
          scaleY: 0,
          transformOrigin: "bottom center",
          duration: 0.8,
          stagger: 0.08,
          ease: "power2.out",
          clearProps: "transform",
        });
      });
      return () => mm.revert();
    },
    { scope: barsRef, dependencies: [barPixels.join(","), isEmpty] },
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#0F172A]">Call Volume Trend</p>
        {!isEmpty ? (
          <span className="rounded-full bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563EB]">
            {callTotal} calls
          </span>
        ) : null}
      </div>

      {isEmpty ? (
        <div className="mt-4">
          <ChartEmptyState />
          {dailyVolume && dailyVolume.length > 0 ? (
            <div className="mt-3 flex justify-between gap-1 px-1">
              {dailyVolume.map((day) => (
                <span key={day.label} className="flex-1 text-center text-[10px] text-[#CBD5E1]">
                  {day.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div ref={barsRef} className="mt-4">
          <div className="flex gap-2" style={{ height: CHART_HEIGHT_PX }}>
            {barPixels.map((pixelHeight, idx) => (
              <div key={idx} className="flex h-full min-w-0 flex-1 flex-col items-center">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="chart-bar w-full rounded-t-md bg-gradient-to-t from-[#1D4ED8] to-[#2563EB]/85 transition-colors hover:from-[#1E40AF] hover:to-[#2563EB]"
                    style={{ height: pixelHeight }}
                    title={
                      dailyVolume?.[idx]
                        ? `${dailyVolume[idx].label}: ${dailyVolume[idx].count} calls`
                        : undefined
                    }
                  />
                </div>
                {dailyVolume?.[idx] ? (
                  <span className="mt-2 text-[10px] font-medium text-[#94A3B8]">
                    {dailyVolume[idx].label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-[#94A3B8]">
        {isEmpty
          ? "Your workspace — last 7 days · waiting for first call"
          : "Your workspace — last 7 days"}
      </p>
    </Card>
  );
}
