"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, authIcons } from "@/components/auth/AuthField";
import { RouteGate } from "@/components/auth/RouteGate";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  return (
    <RouteGate mode="public">
      <AuthShell
        title="Reset your password"
        subtitle="We'll email you a secure link to set a new password."
        sideTitle="Back into your workspace in a couple of clicks."
        sidePoints={[
          "Reset links are single-use and expire after one hour.",
          "Your active sessions are protected during the reset.",
          "No support ticket required — it's fully self-serve.",
        ]}
      >
        {sent ? (
          <div className="grid gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3.5 text-sm text-[#334155]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="mt-0.5 h-5 w-5 flex-none text-[#2563EB]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
              </svg>
              If an account exists for {email || "that email"}, a reset link is on its way. Check your
              inbox and spam folder.
            </div>
            <Button href="/login" variant="secondary">
              Back to login
            </Button>
          </div>
        ) : (
          <>
            <form
              className="grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError("");
                setBusy(true);
                try {
                  await api.forgotPassword({ email });
                  setSent(true);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
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
              <Button type="submit" className="shine" disabled={busy}>
                {busy ? "Sending link..." : "Send reset link"}
              </Button>
              {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
            </form>
            <p className="mt-4 text-sm text-[#64748B]">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-[#2563EB]">
                Login
              </Link>
            </p>
          </>
        )}
      </AuthShell>
    </RouteGate>
  );
}
