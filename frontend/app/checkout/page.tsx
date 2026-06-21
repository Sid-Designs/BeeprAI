"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RouteGate } from "@/components/auth/RouteGate";
import { PlanCheckoutModal } from "@/components/marketing/PlanCheckoutModal";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { SessionBootstrap } from "@/lib/sessionBootstrap";
import { getPlanIntent, isPaidPlan, setPlanIntent } from "@/lib/planIntent";
import { planCatalog } from "@/lib/plans";
import type { Plan } from "@/lib/types";

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fromUrl = isPaidPlan(planParam) ? planParam : null;
    const fromIntent = getPlanIntent();
    const selected = fromUrl ?? (isPaidPlan(fromIntent) ? fromIntent : null);

    if (!selected) {
      router.replace("/pricing");
      return;
    }

    setPlanIntent(selected);
    setPlan(selected);
    setModalOpen(true);
  }, [planParam, router]);

  if (!plan) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
      </div>
    );
  }

  const catalog = planCatalog[plan];

  return (
    <>
      <SessionBootstrap />
      <div className="mx-auto max-w-lg px-6 py-16">
        <Card className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#2563EB]">Checkout</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A]">
            Complete your {catalog.label} upgrade
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">{catalog.description}</p>

          <div className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-3xl font-semibold text-[#0F172A]">
              ₹{Number(catalog.price).toLocaleString("en-IN")}
              <span className="text-base font-medium text-[#94A3B8]">/mo</span>
            </p>
            <ul className="mt-4 space-y-2">
              {catalog.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#475569]">
                  <span className="text-[#2563EB]">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          <Button className="mt-6 w-full shine" onClick={() => setModalOpen(true)}>
            Proceed to payment
          </Button>
          <p className="mt-4 text-center text-xs text-[#94A3B8]">
            <Link href="/pricing" className="text-[#2563EB] hover:underline">
              ← Back to pricing
            </Link>
          </p>
        </Card>
      </div>

      <PlanCheckoutModal
        open={modalOpen}
        plan={plan}
        onClose={() => setModalOpen(false)}
        onSuccess={() => router.push("/dashboard/settings")}
      />
    </>
  );
}

export default function CheckoutPage() {
  return (
    <RouteGate mode="verified">
      <MarketingPageShell>
        <Suspense
          fallback={
            <div className="flex min-h-[50vh] items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            </div>
          }
        >
          <CheckoutInner />
        </Suspense>
      </MarketingPageShell>
    </RouteGate>
  );
}
