"use client";

import { api } from "@/lib/api";
import { formatInrFromPaise, loadRazorpayScript } from "@/lib/razorpay";
import type { Plan } from "@/lib/types";

function getErrorMessage(err: unknown, fallback = "Something went wrong.") {
  if (err instanceof Error && err.message.trim()) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

export type PaymentConfigResponse = {
  enabled: boolean;
  keyId?: string;
  currency?: string;
  upiId?: string;
  upiPayeeName?: string;
  plans?: Record<string, { label: string; amountPaise: number; currency: string }>;
};

export async function startPlanCheckout({
  tenantId,
  plan,
  userName,
  userEmail,
  onSuccess,
  onError,
}: {
  tenantId: string;
  plan: Plan;
  userName: string;
  userEmail: string;
  onSuccess: (plan: Plan) => void;
  onError: (message: string) => void;
}) {
  if (plan !== "pro" && plan !== "enterprise") {
    onError("Invalid plan selected.");
    return;
  }

  const scriptReady = await loadRazorpayScript();
  if (!scriptReady || !window.Razorpay) {
    onError("Could not load payment checkout. Please try again.");
    return;
  }

  try {
    const orderRes = await api.createPaymentOrder({ tenantId, plan });
    const order = orderRes.data;

    const options = {
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "Beepr",
      description: `${order.planLabel} plan upgrade`,
      order_id: order.orderId,
      prefill: { name: userName, email: userEmail },
      theme: { color: "#2563EB" },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await api.verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          onSuccess(plan);
        } catch (err) {
          onError(getErrorMessage(err, "Payment verification failed."));
        }
      },
      modal: {
        ondismiss: () => {
          onError("Payment cancelled.");
        },
      },
    };

    const checkout = new window.Razorpay(options);
    checkout.open();
  } catch (err) {
    onError(getErrorMessage(err, "Could not start checkout."));
  }
}

export function getPlanPriceLabel(config: PaymentConfigResponse | null, plan: Plan) {
  const entry = config?.plans?.[plan];
  if (!entry?.amountPaise) return null;
  return formatInrFromPaise(entry.amountPaise);
}
