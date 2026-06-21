"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { PlanCheckoutModal } from "@/components/marketing/PlanCheckoutModal";
import {
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  subscribeAuthSession,
} from "@/lib/auth";
import { getAuthRedirectForPlan, setPlanIntent } from "@/lib/planIntent";
import { planCatalog } from "@/lib/plans";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/cn";

function useAuthSession() {
  return useSyncExternalStore(subscribeAuthSession, getAuthSessionSnapshot, getServerAuthSessionSnapshot);
}

export function PricingPlansGrid({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const session = useAuthSession();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  function handlePlanSelect(planKey: Plan) {
    if (planKey === "free") {
      if (session) {
        router.push("/dashboard");
      } else {
        router.push("/signup");
      }
      return;
    }

    setPlanIntent(planKey);

    if (!session) {
      router.push(getAuthRedirectForPlan(planKey));
      return;
    }

    if (!session.verified) {
      router.push(`/verify-email?email=${encodeURIComponent(session.email)}`);
      return;
    }

    setCheckoutPlan(planKey);
  }

  return (
    <>
      <div className={cn("grid items-start gap-5", compact ? "md:grid-cols-3" : "lg:grid-cols-3")}>
        {(Object.entries(planCatalog) as [Plan, (typeof planCatalog)[Plan]][]).map(([key, plan]) => {
          const popular = "popular" in plan && plan.popular;
          return (
            <Card
              key={key}
              hover
              className={cn(
                "relative flex flex-col",
                popular &&
                  "border-[#2563EB] bg-gradient-to-b from-[#EFF6FF] to-white shadow-[0_24px_40px_rgba(37,99,235,0.18)] lg:-mt-4 lg:pb-9 lg:pt-9",
              )}
            >
              {popular ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-md">
                  Most Popular
                </span>
              ) : null}

              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#2563EB]">{plan.label}</p>
              <p className="mt-3 flex items-baseline gap-1 text-4xl font-semibold tracking-[-0.03em] text-[#0F172A]">
                {plan.price === "0" ? "Free" : `₹${Number(plan.price).toLocaleString("en-IN")}`}
                {plan.price !== "0" ? <span className="text-base font-medium text-[#94A3B8]">/mo</span> : null}
              </p>
              <p className="mt-2 text-sm text-[#64748B]">{plan.description}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-[#334155]">
                    <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <Button
                variant={popular ? "primary" : "secondary"}
                className="mt-6 w-full"
                onClick={() => handlePlanSelect(key)}
              >
                {plan.price === "0" ? "Start free" : `Get ${plan.label}`}
              </Button>
            </Card>
          );
        })}
      </div>

      {checkoutPlan ? (
        <PlanCheckoutModal
          open={Boolean(checkoutPlan)}
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => setCheckoutPlan(null)}
        />
      ) : null}
    </>
  );
}
