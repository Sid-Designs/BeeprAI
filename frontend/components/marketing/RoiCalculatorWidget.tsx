"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import {
  calculateRoi,
  defaultRoiInputs,
  formatInr,
  type RoiInputs,
} from "@/lib/roiCalculator";
import { planCatalog } from "@/lib/plans";
import { cn } from "@/lib/cn";

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-[#0F172A]">{label}</label>
        <span className="text-sm font-semibold text-[#2563EB]">
          {value.toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
      {hint ? <p className="mt-0.5 text-xs text-[#94A3B8]">{hint}</p> : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-[#2563EB]"
      />
    </div>
  );
}

export function RoiCalculatorWidget({ showCta = true }: { showCta?: boolean }) {
  const [inputs, setInputs] = useState<RoiInputs>(defaultRoiInputs);
  const result = calculateRoi(inputs);
  const recommended = planCatalog[result.recommendedPlan];

  function patch(partial: Partial<RoiInputs>) {
    setInputs((prev) => ({ ...prev, ...partial }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold text-[#0F172A]">Your business inputs</h3>
          <p className="mt-1 text-sm text-[#64748B]">
            Adjust sliders to match your outbound calling volume and team costs.
          </p>
        </div>

        <SliderField
          label="Monthly outbound calls"
          hint="How many calls does your team make or want to automate?"
          value={inputs.monthlyCalls}
          min={10}
          max={600}
          step={10}
          onChange={(v) => patch({ monthlyCalls: v })}
        />
        <SliderField
          label="Avg. call duration"
          value={inputs.avgCallMinutes}
          min={1}
          max={15}
          step={1}
          suffix=" min"
          onChange={(v) => patch({ avgCallMinutes: v })}
        />
        <SliderField
          label="Human agent hourly cost"
          value={inputs.humanHourlyRate}
          min={150}
          max={800}
          step={25}
          suffix=" ₹"
          onChange={(v) => patch({ humanHourlyRate: v })}
        />
        <SliderField
          label="Current conversion rate"
          value={inputs.conversionRate}
          min={1}
          max={20}
          step={0.5}
          suffix="%"
          onChange={(v) => patch({ conversionRate: v })}
        />
        <SliderField
          label="Conversion uplift with AI"
          hint="Beepr agents follow scripts consistently and never miss follow-ups."
          value={inputs.conversionUplift}
          min={5}
          max={50}
          step={1}
          suffix="%"
          onChange={(v) => patch({ conversionUplift: v })}
        />
        <SliderField
          label="Avg. revenue per conversion"
          value={inputs.avgDealValue}
          min={1000}
          max={50000}
          step={500}
          suffix=" ₹"
          onChange={(v) => patch({ avgDealValue: v })}
        />
      </Card>

      <div className="space-y-5">
        <Card
          className={cn(
            "p-6 sm:p-8",
            result.isProfitable
              ? "border-[#BBF7D0] bg-gradient-to-b from-[#F0FDF4] to-white"
              : "border-[#FDE68A] bg-gradient-to-b from-[#FFFBEB] to-white",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                Verdict
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A]">
                {result.isProfitable
                  ? "Beepr is profitable for your business"
                  : "Adjust volume or deal value to see ROI"}
              </h3>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                result.isProfitable ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#B45309]",
              )}
            >
              {result.isProfitable ? "Positive ROI" : "Review inputs"}
            </span>
          </div>

          <p className="mt-4 text-sm text-[#64748B]">
            Recommended plan:{" "}
            <strong className="text-[#0F172A]">{recommended.label}</strong> (
            {result.planCost === 0
              ? "Free"
              : `${formatInr(result.planCost)}/mo`}
            ) — up to {recommended.calls} calls and {recommended.agents} agents.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                Monthly labor savings
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">
                {formatInr(result.laborSavings)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                Revenue uplift
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">
                {formatInr(result.revenueUplift)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">
                Net monthly gain
              </p>
              <p
                className={cn(
                  "mt-1 text-2xl font-semibold",
                  result.netMonthlyGain >= 0 ? "text-[#15803D]" : "text-[#B91C1C]",
                )}
              >
                {formatInr(result.netMonthlyGain)}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">ROI</p>
              <p className="mt-1 text-2xl font-semibold text-[#0F172A]">
                {result.roiPercent !== null ? `${result.roiPercent}%` : "∞ (free plan)"}
              </p>
              {result.paybackDays !== null && result.planCost > 0 ? (
                <p className="mt-1 text-xs text-[#94A3B8]">Payback in ~{result.paybackDays} days</p>
              ) : null}
            </div>
          </div>

          {result.breakevenCalls ? (
            <p className="mt-4 text-sm text-[#64748B]">
              You break even at approximately{" "}
              <strong className="text-[#0F172A]">{result.breakevenCalls} calls/month</strong> on the{" "}
              {recommended.label} plan.
            </p>
          ) : null}
        </Card>

        {showCta ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button href="/signup" className="shine flex-1">
              Start free — {recommended.calls} calls included
            </Button>
            {result.recommendedPlan !== "free" ? (
              <Button
                href={`/login?returnTo=${encodeURIComponent("/checkout")}&plan=${result.recommendedPlan}`}
                variant="secondary"
                className="flex-1"
              >
                Get {recommended.label}
              </Button>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-[#94A3B8]">
          Estimates assume {inputs.automationRate}% of call handling is automated. Actual results vary
          by industry and script quality.{" "}
          <Link href="/pricing" className="text-[#2563EB] hover:underline">
            View plan details
          </Link>
        </p>
      </div>
    </div>
  );
}
