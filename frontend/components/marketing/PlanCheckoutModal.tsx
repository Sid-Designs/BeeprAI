"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { api } from "@/lib/api";
import { getAuthSession, getTenantId } from "@/lib/auth";
import { planCatalog } from "@/lib/plans";
import {
  getPlanPriceLabel,
  startPlanCheckout,
  type PaymentConfigResponse,
} from "@/lib/planCheckout";
import { clearPlanIntent } from "@/lib/planIntent";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/cn";

export function PlanCheckoutModal({
  open,
  plan,
  onClose,
  onSuccess,
}: {
  open: boolean;
  plan: Plan;
  onClose: () => void;
  onSuccess?: (plan: Plan) => void;
}) {
  const router = useRouter();
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const catalog = planCatalog[plan];
  const session = getAuthSession();
  const tenantId = getTenantId();
  const priceLabel = getPlanPriceLabel(paymentConfig, plan);

  useEffect(() => {
    if (!open) return;
    api
      .getPaymentConfig()
      .then((res) => setPaymentConfig(res.data))
      .catch(() => setPaymentConfig({ enabled: false }));
  }, [open]);

  async function handleCheckout() {
    if (!tenantId || !session) {
      router.push(`/login?returnTo=${encodeURIComponent("/checkout")}&plan=${plan}`);
      return;
    }

    if (plan !== "pro" && plan !== "enterprise") return;

    setBusy(true);
    setMessage(null);
    await startPlanCheckout({
      tenantId,
      plan,
      userName: session.fullName,
      userEmail: session.email,
      onSuccess: (upgradedPlan) => {
        clearPlanIntent();
        setMessage({
          type: "success",
          text: `Payment successful! Your ${planCatalog[upgradedPlan].label} plan is now active.`,
        });
        setBusy(false);
        onSuccess?.(upgradedPlan);
      },
      onError: (text) => {
        if (text !== "Payment cancelled.") {
          setMessage({ type: "error", text });
        }
        setBusy(false);
      },
    });
  }

  if (plan === "free") return null;

  return (
    <Modal open={open} title={`Upgrade to ${catalog.label}`} onClose={onClose} wide>
      <div className="space-y-5">
        <div className="rounded-xl border border-[#DBEAFE] bg-gradient-to-b from-[#EFF6FF] to-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-[#0F172A]">{catalog.label} plan</p>
              <p className="mt-1 text-sm text-[#64748B]">{catalog.description}</p>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#0F172A]">
              {priceLabel ?? `₹${Number(catalog.price).toLocaleString("en-IN")}`}
              <span className="text-base font-medium text-[#94A3B8]">/mo</span>
            </p>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {catalog.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-[#334155]">
                <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {!paymentConfig?.enabled ? (
          <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
            Payments are not configured yet. Contact support or try again later from Settings.
          </div>
        ) : null}

        {!tenantId ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-[#64748B]">
            Complete workspace setup first, then return here to upgrade your plan.
          </div>
        ) : null}

        {message ? (
          <div
            className={cn(
              "rounded-xl px-4 py-3 text-sm",
              message.type === "success"
                ? "border border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]"
                : "border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
            )}
          >
            {message.text}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {message?.type === "success" ? "Close" : "Cancel"}
          </Button>
          {message?.type === "success" ? (
            <Button onClick={() => router.push("/dashboard/settings")}>Go to Settings</Button>
          ) : (
            <Button
              className="shine"
              disabled={busy || !paymentConfig?.enabled || !tenantId}
              onClick={handleCheckout}
            >
              {busy ? "Opening checkout..." : `Pay & activate ${catalog.label}`}
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-[#94A3B8]">
          Secure payment via Razorpay. Your plan limits update immediately after verification.
        </p>
      </div>
    </Modal>
  );
}
