/**
 * Razorpay amounts in INR paise (₹1 = 100 paise).
 * Override via env: PAYMENT_PRO_AMOUNT_PAISE, PAYMENT_ENTERPRISE_AMOUNT_PAISE
 */
export const PAYMENT_PLANS = Object.freeze({
  pro: {
    label: "Pro",
    amountPaise: Number(process.env.PAYMENT_PRO_AMOUNT_PAISE) || 399900,
    currency: "INR",
  },
  enterprise: {
    label: "Enterprise",
    amountPaise: Number(process.env.PAYMENT_ENTERPRISE_AMOUNT_PAISE) || 899900,
    currency: "INR",
  },
});

export function getPaymentPlan(plan) {
  return PAYMENT_PLANS[plan] ?? null;
}
