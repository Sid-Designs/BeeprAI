"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, authIcons } from "@/components/auth/AuthField";
import { RouteGate } from "@/components/auth/RouteGate";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";
import { getPlanIntent, isPaidPlan } from "@/lib/planIntent";

type Status = "idle" | "verifying" | "success" | "error";

function VerifyEmailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const emailParam = params.get("email") ?? "";

  const [status, setStatus] = useState<Status>(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(emailParam);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendNote, setResendNote] = useState("");
  const verifiedOnce = useRef(false);

  useEffect(() => {
    if (!token || verifiedOnce.current) return;
    verifiedOnce.current = true;

    (async () => {
      try {
        await api.verifyEmail(token);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setMessage((err as Error).message);
      }
    })();
  }, [token]);

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    setResendBusy(true);
    setResendNote("");
    try {
      const res = await api.resendVerification({ email });
      setResendNote(res.message || "Verification email sent. Check your inbox.");
    } catch (err) {
      setResendNote((err as Error).message);
    } finally {
      setResendBusy(false);
    }
  }

  // ── Token flow: verifying / success / error ──────────────────────────────
  if (token) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Confirming your account."
        sideTitle="One step away from launching your first AI agent."
        sidePoints={[
          "Email verification secures your workspace setup.",
          "Guided onboarding starts immediately after verification.",
          "No technical setup required to launch your first call.",
        ]}
      >
        {status === "verifying" ? (
          <div className="flex items-center gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3.5 text-sm text-[#2563EB]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            Verifying your email address...
          </div>
        ) : null}

        {status === "success" ? (
          <div className="grid gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3.5 text-sm text-[#14532D]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-none text-[#16A34A]">
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                  clipRule="evenodd"
                />
              </svg>
              Your email is verified. Sign in to start the guided setup — workspace, agent, bookings, and your first call.
            </div>
            <Button
              onClick={() => {
                const intent = getPlanIntent();
                if (isPaidPlan(intent)) {
                  router.push(`/login?verified=1&returnTo=${encodeURIComponent("/checkout")}&plan=${intent}`);
                } else {
                  router.push("/login?verified=1");
                }
              }}
            >
              Continue to login
            </Button>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="grid gap-4">
            <p className="text-sm text-[#EF4444]">
              {message || "This verification link is invalid or has expired."}
            </p>
            <form className="grid gap-3" onSubmit={handleResend}>
              <AuthField
                id="email"
                label="Resend verification to"
                type="email"
                icon={authIcons.mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
              <Button type="submit" variant="secondary" disabled={resendBusy}>
                {resendBusy ? "Sending..." : "Resend verification email"}
              </Button>
              {resendNote ? <p className="text-sm text-[#64748B]">{resendNote}</p> : null}
            </form>
          </div>
        ) : null}
      </AuthShell>
    );
  }

  // ── Inbox flow: "check your email" + resend ──────────────────────────────
  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        emailParam
          ? `We sent a verification link to ${emailParam}.`
          : "We sent you a verification link."
      }
      sideTitle="One step away from launching your first AI agent."
      sidePoints={[
        "Email verification secures your workspace setup.",
        "Guided onboarding starts immediately after verification.",
        "No technical setup required to launch your first call.",
      ]}
    >
      <div className="grid gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3.5 text-sm text-[#334155]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="mt-0.5 h-5 w-5 flex-none text-[#2563EB]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
          </svg>
          Open the email and click the verification link to activate your account. The link expires in
          24 hours.
        </div>

        <form className="grid gap-3" onSubmit={handleResend}>
          {!emailParam ? (
            <AuthField
              id="email"
              label="Your email"
              type="email"
              icon={authIcons.mail}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          ) : null}
          <Button type="submit" variant="secondary" disabled={resendBusy}>
            {resendBusy ? "Sending..." : "Resend verification email"}
          </Button>
          {resendNote ? <p className="text-sm text-[#64748B]">{resendNote}</p> : null}
        </form>

        <p className="text-sm text-[#64748B]">
          Already verified?{" "}
          <Link href="/login" className="font-semibold text-[#2563EB]">
            Login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <RouteGate mode="public">
      <Suspense fallback={null}>
        <VerifyEmailInner />
      </Suspense>
    </RouteGate>
  );
}
