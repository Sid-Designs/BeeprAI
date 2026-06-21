"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, authIcons } from "@/components/auth/AuthField";
import { RouteGate } from "@/components/auth/RouteGate";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";
import { resetOnboardingState } from "@/lib/auth";
import { isPaidPlan, setPlanIntent } from "@/lib/planIntent";

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isPaidPlan(planParam)) setPlanIntent(planParam);
  }, [planParam]);

  const loginHref = isPaidPlan(planParam)
    ? `/login?returnTo=${encodeURIComponent("/checkout")}&plan=${planParam}`
    : "/login";

  return (
    <RouteGate mode="public">
      <AuthShell
        title="Create your account"
        subtitle="Launch your first AI voice agent in minutes."
        sideTitle="AI calling that feels enterprise-ready on day one."
        sidePoints={[
          "Voice agents trained on your business knowledge.",
          "Guided setup from workspace creation to first call.",
          "Analytics designed for growth and operations teams.",
        ]}
      >
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");

            if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
            }

            setBusy(true);
            try {
              await api.register({ fullName, email, phone, password });
              // Fresh onboarding slate for the new account.
              resetOnboardingState();
              router.push(`/verify-email?email=${encodeURIComponent(email)}`);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <AuthField
            id="fullName"
            label="Full name"
            icon={authIcons.user}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            placeholder="Jane Doe"
            required
          />
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
            id="phone"
            label="Phone number"
            type="tel"
            icon={authIcons.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            autoComplete="tel"
            required
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            icon={authIcons.lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Create a strong password"
            hint="At least 8 characters with an uppercase letter, a number, and a symbol."
            required
          />
          <AuthField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            icon={authIcons.lock}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            required
          />
          <Button type="submit" className="shine" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </Button>
          {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
        </form>
        <p className="mt-4 text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link href={loginHref} className="font-semibold text-[#2563EB]">
            Login
          </Link>
        </p>
      </AuthShell>
    </RouteGate>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
