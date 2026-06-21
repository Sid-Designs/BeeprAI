"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, authIcons } from "@/components/auth/AuthField";
import { RouteGate } from "@/components/auth/RouteGate";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";
import { setAccessToken, setAuthSession, getOnboardingPostAuthRoute } from "@/lib/auth";
import { getPlanIntent, isPaidPlan, setPlanIntent } from "@/lib/planIntent";
import { bootstrapWorkspaceSession } from "@/lib/sessionBootstrap";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const emailVerified = searchParams.get("verified") === "1";
  const returnTo = searchParams.get("returnTo");
  const planParam = searchParams.get("plan");

  useEffect(() => {
    if (isPaidPlan(planParam)) setPlanIntent(planParam);
  }, [planParam]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <RouteGate mode="public">
      <AuthShell
        title="Welcome back"
        subtitle="Continue to your Beepr workspace."
        sideTitle="Build voice operations your customers trust."
        sidePoints={[
          "Handle inbound and outbound conversations with one AI stack.",
          "Keep messaging consistent using your business knowledge.",
          "Track conversion outcomes from one premium workspace.",
        ]}
        >
          {passwordChanged ? (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]">
              Password updated. Sign in with your new password.
            </div>
          ) : null}
          {emailVerified ? (
            <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#15803D]">
              Email verified. Sign in to start your guided workspace setup.
            </div>
          ) : null}
          <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setBusy(true);
            try {
              const res = await api.login({ email, password });
              const { accessToken, user } = res.data;

              setAccessToken(accessToken);
              setAuthSession({
                userId: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                role: user.role,
                organizationId: user.organizationId,
                verified: user.isEmailVerified,
                isPlatformAdmin: Boolean(user.isPlatformAdmin),
                createdAt: user.createdAt ?? new Date().toISOString(),
              });

              await bootstrapWorkspaceSession();

              const checkoutPending =
                returnTo === "/checkout" || isPaidPlan(getPlanIntent());
              if (checkoutPending) {
                router.push("/checkout");
                return;
              }
              if (returnTo && returnTo.startsWith("/")) {
                router.push(returnTo);
                return;
              }
              router.push(getOnboardingPostAuthRoute());
            } catch (err) {
              const e = err as Error & { code?: string };
              if (e.code === "EMAIL_NOT_VERIFIED") {
                router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                return;
              }
              setError(e.message);
              setBusy(false);
            }
          }}
        >
          <AuthField
            id="email"
            label="Work email"
            type="email"
            icon={authIcons.mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            required
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            icon={authIcons.lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            labelAddon={
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
              >
                Forgot password?
              </Link>
            }
          />
          <Button type="submit" className="shine" disabled={busy}>
            {busy ? "Signing in..." : "Login"}
          </Button>
          {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
        </form>
        <p className="mt-4 text-sm text-[#64748B]">
          New to Beepr?{" "}
          <Link
            href={
              isPaidPlan(planParam)
                ? `/signup?plan=${planParam}`
                : returnTo
                  ? `/signup?returnTo=${encodeURIComponent(returnTo)}`
                  : "/signup"
            }
            className="font-semibold text-[#2563EB]"
          >
            Create account
          </Link>
        </p>
      </AuthShell>
    </RouteGate>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
