import type { Plan } from "@/lib/types";

const PLAN_INTENT_KEY = "beepr.plan.intent";

export function isPaidPlan(plan: string | null | undefined): plan is "pro" | "enterprise" {
  return plan === "pro" || plan === "enterprise";
}

export function setPlanIntent(plan: Plan) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLAN_INTENT_KEY, plan);
}

export function getPlanIntent(): Plan | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PLAN_INTENT_KEY);
  if (raw === "free" || raw === "pro" || raw === "enterprise") return raw;
  return null;
}

export function clearPlanIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PLAN_INTENT_KEY);
}

export function getAuthRedirectForPlan(plan: Plan): string {
  if (plan === "free") return "/signup";
  setPlanIntent(plan);
  return `/login?returnTo=${encodeURIComponent("/checkout")}&plan=${plan}`;
}

export function getPostAuthRoute(returnTo?: string | null): string {
  const intent = getPlanIntent();
  if (returnTo === "/checkout" || isPaidPlan(intent)) return "/checkout";
  return returnTo ?? "";
}
