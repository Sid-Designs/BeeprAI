"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField, authIcons } from "@/components/auth/AuthField";
import { RouteGate } from "@/components/auth/RouteGate";
import { Button } from "@/components/shared/Button";
import { api } from "@/lib/api";

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthShell
        title="Reset link invalid"
        subtitle="This password reset link is missing or malformed."
        sideTitle="Let's get you a fresh, secure reset link."
        sidePoints={[
          "Reset links expire after one hour for your security.",
          "You can request a new link any time.",
          "Your account stays protected until you set a new password.",
        ]}
      >
        <div className="grid gap-4">
          <p className="text-sm text-[#EF4444]">
            No reset token was found. Please request a new password reset link.
          </p>
          <Button href="/forgot-password">Request a new link</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={done ? "Password updated" : "Set a new password"}
      subtitle={
        done
          ? "Your password has been changed successfully."
          : "Choose a strong password for your account."
      }
      sideTitle="A fresh password, a secure workspace."
      sidePoints={[
        "All other sessions are signed out when you reset.",
        "Use at least 8 characters with a symbol and a number.",
        "You'll be ready to sign back in immediately.",
      ]}
    >
      {done ? (
        <div className="grid gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3.5 text-sm text-[#14532D]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 flex-none text-[#16A34A]">
              <path
                fillRule="evenodd"
                d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                clipRule="evenodd"
              />
            </svg>
            You can now sign in with your new password.
          </div>
          <Button onClick={() => router.push("/login")}>Continue to login</Button>
        </div>
      ) : (
        <>
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
                await api.resetPassword(token, { password, confirmPassword });
                setDone(true);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <AuthField
              id="password"
              label="New password"
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
              label="Confirm new password"
              type="password"
              icon={authIcons.lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              required
            />
            <Button type="submit" className="shine" disabled={busy}>
              {busy ? "Updating..." : "Update password"}
            </Button>
            {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          </form>
          <p className="mt-4 text-sm text-[#64748B]">
            Back to{" "}
            <Link href="/login" className="font-semibold text-[#2563EB]">
              Login
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <RouteGate mode="public">
      <Suspense fallback={null}>
        <ResetPasswordInner />
      </Suspense>
    </RouteGate>
  );
}
