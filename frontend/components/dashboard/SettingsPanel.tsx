"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  clearAuthSession,
  getAuthSession,
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  getTenantId,
  setAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from "@/lib/auth";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Input, Label } from "@/components/shared/FormField";
import type { Plan, Tenant, TenantUsage } from "@/lib/types";
import { planCatalog } from "@/lib/plans";
import { getPlanPriceLabel, startPlanCheckout, type PaymentConfigResponse } from "@/lib/planCheckout";
import { cn } from "@/lib/cn";

const quickLinks = [
  { href: "/dashboard/agents", label: "Manage agents", desc: "Create and configure AI voice agents" },
  { href: "/dashboard/calls", label: "Start a call", desc: "Launch outbound customer calls" },
  { href: "/dashboard/knowledge", label: "Upload knowledge", desc: "Add docs and context for agents" },
  { href: "/onboarding/workspace", label: "Guided setup", desc: "Walk through the full onboarding flow" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agentManager: "Agent Manager",
  viewer: "Viewer",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-[#94A3B8]">{label}</span>
      <span className="text-sm font-medium text-[#0F172A] sm:text-right">{value}</span>
    </div>
  );
}

const roleCapabilities: Record<string, string[]> = {
  owner: [
    "Manage workspace and billing",
    "Create and configure AI agents",
    "Upload knowledge and start calls",
    "Manage team roles",
  ],
  admin: [
    "Manage workspace settings",
    "Create and configure AI agents",
    "Upload knowledge and start calls",
    "Manage team members",
  ],
  agentManager: [
    "Create and configure AI agents",
    "Upload knowledge sources",
    "Start and monitor outbound calls",
  ],
  viewer: [
    "View dashboard and analytics",
    "Browse call history",
    "Test knowledge retrieval",
  ],
};

function formatMemberSince(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function ProfileSection({ user }: { user: AuthSession }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "password">("view");

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const displayName = mode === "view" ? user.fullName : fullName;
  const displayPhone = user.phone?.trim() || "Not set";
  const capabilities = roleCapabilities[user.role] ?? roleCapabilities.viewer;

  function openEdit() {
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setProfileMessage(null);
    setMode("edit");
  }

  function cancelEdit() {
    setFullName(user.fullName);
    setPhone(user.phone ?? "");
    setProfileMessage(null);
    setMode("view");
  }

  function openPassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
    setResetMessage(null);
    setMode("password");
  }

  function cancelPassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage(null);
    setResetMessage(null);
    setMode("view");
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setProfileMessage({ type: "error", text: "Name must be at least 2 characters." });
      return;
    }

    setProfileBusy(true);
    setProfileMessage(null);
    try {
      const res = await api.updateProfile({
        fullName: trimmedName,
        phone: phone.trim() || undefined,
      });
      const updated = res.data.user;
      const session = getAuthSession();
      if (session) {
        setAuthSession({
          ...session,
          fullName: updated.fullName,
          phone: updated.phone,
        });
      }
      setProfileMessage({ type: "success", text: "Profile updated successfully." });
      setMode("view");
    } catch (err) {
      setProfileMessage({ type: "error", text: (err as Error).message });
    } finally {
      setProfileBusy(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordMessage(null);
    try {
      await api.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      clearAuthSession();
      router.push("/login?passwordChanged=1");
    } catch (err) {
      setPasswordMessage({ type: "error", text: (err as Error).message });
      setPasswordBusy(false);
    }
  }

  async function handleSendResetLink() {
    setResetBusy(true);
    setResetMessage(null);
    try {
      await api.forgotPassword({ email: user.email });
      setResetMessage({
        type: "success",
        text: `Reset link sent to ${user.email}. Check your inbox and spam folder.`,
      });
    } catch (err) {
      setResetMessage({ type: "error", text: (err as Error).message });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-lg font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.3)]">
            {initials(displayName)}
          </span>
          <div>
            <p className="text-base font-semibold text-[#0F172A]">{displayName}</p>
            <p className="text-sm text-[#64748B]">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[#EFF6FF] px-2 py-0.5 text-xs font-semibold text-[#2563EB]">
                {roleLabels[user.role] ?? user.role}
              </span>
              {user.verified ? (
                <span className="inline-flex rounded-full bg-[#F0FDF4] px-2 py-0.5 text-xs font-semibold text-[#16A34A]">
                  Verified
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-semibold text-[#B45309]">
                  Email pending
                </span>
              )}
            </div>
          </div>
        </div>

        {mode === "view" ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={openEdit}>
              Edit profile
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={openPassword}>
              Change password
            </Button>
          </div>
        ) : null}
      </div>

      {profileMessage && mode === "view" ? (
        <InlineAlert variant={profileMessage.type}>{profileMessage.text}</InlineAlert>
      ) : null}

      {mode === "view" ? (
        <>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">Account information</h3>
            <div className="mt-4 divide-y divide-[#E2E8F0]">
              <div className="py-3 first:pt-0">
                <DetailRow label="Full name" value={user.fullName} />
              </div>
              <div className="py-3">
                <DetailRow label="Email" value={user.email} />
              </div>
              <div className="py-3">
                <DetailRow label="Phone" value={displayPhone} />
              </div>
              <div className="py-3">
                <DetailRow label="Member since" value={formatMemberSince(user.createdAt)} />
              </div>
              <div className="py-3 last:pb-0">
                <DetailRow label="Password" value="••••••••" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <h3 className="text-sm font-semibold text-[#0F172A]">Security & access</h3>
            <p className="mt-1 text-xs text-[#64748B]">
              What you can do in this workspace as{" "}
              <span className="font-medium text-[#334155]">{roleLabels[user.role] ?? user.role}</span>.
            </p>
            <ul className="mt-3 space-y-2">
              {capabilities.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#475569]">
                  <span className="mt-0.5 text-[#2563EB]">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {user.verified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
                  Email verified
                </span>
              ) : (
                <Link
                  href={`/verify-email?email=${encodeURIComponent(user.email)}`}
                  className="inline-flex items-center rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#B45309] hover:bg-[#FDE68A]"
                >
                  Verify email →
                </Link>
              )}
              {user.isPlatformAdmin ? (
                <Link
                  href="/dashboard/admin"
                  className="inline-flex items-center rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-[#DBEAFE]"
                >
                  Platform admin
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link
              href="/dashboard"
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm transition hover:border-[#BFDBFE] hover:bg-white"
            >
              <span className="font-semibold text-[#0F172A]">Dashboard</span>
              <p className="mt-0.5 text-xs text-[#64748B]">Overview & quick actions</p>
            </Link>
            <Link
              href="/dashboard/calls"
              className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm transition hover:border-[#BFDBFE] hover:bg-white"
            >
              <span className="font-semibold text-[#0F172A]">Start a call</span>
              <p className="mt-0.5 text-xs text-[#64748B]">Launch outbound voice</p>
            </Link>
          </div>
        </>
      ) : null}

      {mode === "edit" ? (
        <form
          onSubmit={handleProfileSave}
          className="rounded-xl border border-[#BFDBFE] bg-[#F8FAFC] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Edit profile</h3>
              <p className="mt-1 text-xs text-[#64748B]">Update how your name appears across Beepr.</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                minLength={2}
              />
            </div>
            <div>
              <Label htmlFor="profile-phone">Phone</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <p className="text-xs text-[#94A3B8]">
              Email cannot be changed here. Contact support if you need to update it.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={profileBusy}>
              {profileBusy ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          </div>

          {profileMessage ? (
            <InlineAlert variant={profileMessage.type} className="mt-4">
              {profileMessage.text}
            </InlineAlert>
          ) : null}
        </form>
      ) : null}

      {mode === "password" ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Change password</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                Enter your current password, then choose a new one.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelPassword}
              className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handlePasswordChange} className="mt-4 grid gap-3">
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <p className="text-xs text-[#94A3B8]">
              At least 8 characters with uppercase, number, and special character.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" variant="secondary" disabled={passwordBusy}>
                {passwordBusy ? "Updating…" : "Update password"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancelPassword}>
                Cancel
              </Button>
            </div>
          </form>

          {passwordMessage ? (
            <InlineAlert variant={passwordMessage.type} className="mt-4">
              {passwordMessage.text}
            </InlineAlert>
          ) : null}

          <div className="mt-5 rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-sm font-medium text-[#0F172A]">Forgot your password?</p>
            <p className="mt-1 text-xs text-[#64748B]">
              We&apos;ll email a reset link to{" "}
              <span className="font-medium text-[#334155]">{user.email}</span>.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={resetBusy}
                onClick={handleSendResetLink}
              >
                {resetBusy ? "Sending…" : "Email reset link"}
              </Button>
              <Link
                href="/forgot-password"
                className="inline-flex h-9 items-center px-3 text-sm font-medium text-[#2563EB] hover:underline"
              >
                Use a different email
              </Link>
            </div>
            {resetMessage ? (
              <InlineAlert variant={resetMessage.type} className="mt-3">
                {resetMessage.text}
              </InlineAlert>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getNextPlan(plan: Plan): Plan | null {
  if (plan === "free") return "pro";
  if (plan === "pro") return "enterprise";
  return null;
}

function UsageMeter({
  label,
  used,
  max,
  remaining,
  accentClass,
}: {
  label: string;
  used: number;
  max: number;
  remaining?: number;
  accentClass: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const nearLimit = pct >= 80;

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#64748B]">{label}</span>
        <span className="font-semibold text-[#0F172A]">
          {used} / {max > 0 ? max : "—"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF2F7]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            nearLimit ? "bg-gradient-to-r from-[#F59E0B] to-[#EF4444]" : accentClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining !== undefined ? (
        <p className="mt-1 text-xs text-[#94A3B8]">
          {remaining} remaining this month
        </p>
      ) : null}
    </div>
  );
}

function WorkspaceSection({
  tenantId,
  user,
  tenant,
  usage,
  workspaceMessage,
  onRefresh,
}: {
  tenantId: string | null;
  user: AuthSession | null;
  tenant: Tenant | null;
  usage: TenantUsage | null;
  workspaceMessage: { type: "success" | "error" | "info"; text: string } | null;
  onRefresh: () => void;
}) {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    api
      .getPaymentConfig()
      .then((res) => setPaymentConfig(res.data))
      .catch(() => setPaymentConfig({ enabled: false }));
  }, []);

  const plan = (tenant?.plan ?? usage?.plan ?? "free") as Plan;
  const currentPlan = planCatalog[plan];
  const nextPlanKey = getNextPlan(plan);
  const nextPlan = nextPlanKey ? planCatalog[nextPlanKey] : null;

  const callsUsed = usage?.usage?.callsUsed ?? tenant?.usage?.callsUsed ?? 0;
  const agentsUsed = usage?.usage?.agentsUsed ?? tenant?.usage?.agentsUsed ?? 0;
  const callsMax =
    usage?.usageLimits?.maxCallsPerMonth ?? tenant?.usageLimits?.maxCallsPerMonth ?? currentPlan.calls;
  const agentsMax =
    usage?.usageLimits?.maxAgents ?? tenant?.usageLimits?.maxAgents ?? currentPlan.agents;
  const callsRemaining = usage?.callsRemaining ?? Math.max(0, callsMax - callsUsed);
  const agentsRemaining = usage?.agentsRemaining ?? Math.max(0, agentsMax - agentsUsed);

  const canUpgrade =
    Boolean(paymentConfig?.enabled && tenantId && user) &&
    (user?.role === "owner" || user?.role === "admin");
  const nextPlanPrice =
    nextPlanKey ? getPlanPriceLabel(paymentConfig, nextPlanKey) : null;

  async function handleUpgrade() {
    if (!nextPlanKey || !tenantId || !user) return;
    setUpgradeBusy(true);
    setPaymentMessage(null);
    await startPlanCheckout({
      tenantId,
      plan: nextPlanKey,
      userName: user.fullName,
      userEmail: user.email,
      onSuccess: (upgradedPlan) => {
        setPaymentMessage({
          type: "success",
          text: `Upgraded to ${upgradedPlan} plan. Your new limits are active.`,
        });
        setUpgradeBusy(false);
        onRefresh();
      },
      onError: (message) => {
        if (message !== "Payment cancelled.") {
          setPaymentMessage({ type: "error", text: message });
        }
        setUpgradeBusy(false);
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">{tenant?.orgName ?? "—"}</p>
            <p className="mt-0.5 text-xs text-[#64748B]">{tenant?.industry ?? "—"}</p>
          </div>
          <span className="inline-flex rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
            {currentPlan.label} plan
          </span>
        </div>
        <p className="mt-3 text-sm text-[#64748B]">{currentPlan.description}</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {currentPlan.features.slice(0, 4).map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-xs text-[#475569]">
              <span className="text-[#2563EB]">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Usage this month</h3>
        <p className="mt-1 text-xs text-[#64748B]">Track how much of your plan you&apos;ve used.</p>
        <div className="mt-4 space-y-4">
          <UsageMeter
            label="Outbound calls"
            used={callsUsed}
            max={callsMax}
            remaining={callsRemaining}
            accentClass="bg-gradient-to-r from-[#2563EB] to-[#38BDF8]"
          />
          <UsageMeter
            label="AI agents"
            used={agentsUsed}
            max={agentsMax}
            remaining={agentsRemaining}
            accentClass="bg-gradient-to-r from-[#6366F1] to-[#818CF8]"
          />
        </div>
      </div>

      {nextPlan ? (
        <div className="rounded-xl border border-[#BFDBFE] bg-gradient-to-br from-[#EFF6FF] via-white to-[#F5F3FF] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#2563EB]">
                Recommended upgrade
              </p>
              <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
                {nextPlan.label}
                {nextPlanPrice ? ` — ${nextPlanPrice}/mo` : ` — $${nextPlan.price}/mo`}
              </h3>
              <p className="mt-1 text-sm text-[#64748B]">{nextPlan.description}</p>
            </div>
            {nextPlanKey === "pro" ? (
              <span className="rounded-full bg-[#2563EB] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Popular
              </span>
            ) : null}
          </div>
          <ul className="mt-4 space-y-1.5">
            {nextPlan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-[#334155]">
                <span className="text-[#2563EB]">+</span>
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={!canUpgrade || upgradeBusy}
              onClick={handleUpgrade}
            >
              {upgradeBusy ? "Opening checkout…" : `Upgrade to ${nextPlan.label}`}
            </Button>
            {!paymentConfig?.enabled ? (
              <span className="text-xs text-[#94A3B8]">Payments not configured yet</span>
            ) : null}
          </div>
          {paymentConfig?.upiId ? (
            <p className="mt-3 text-xs text-[#64748B]">
              UPI option in checkout, or pay to{" "}
              <span className="font-medium text-[#334155]">{paymentConfig.upiId}</span>
              {paymentConfig.upiPayeeName ? ` (${paymentConfig.upiPayeeName})` : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
          You&apos;re on our highest plan. Contact us for custom volume and support.
        </div>
      )}

      {paymentMessage ? (
        <InlineAlert variant={paymentMessage.type}>{paymentMessage.text}</InlineAlert>
      ) : null}

      {workspaceMessage ? (
        <InlineAlert variant={workspaceMessage.type}>{workspaceMessage.text}</InlineAlert>
      ) : null}
    </div>
  );
}

export function SettingsPanel() {
  const tenantId = getTenantId();
  const user = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [workspaceMessage, setWorkspaceMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(tenantId ? null : { type: "info", text: "No active workspace session. Set up from Overview." });

  useEffect(() => {
    if (!tenantId) return;
    refreshWorkspace();
  }, [tenantId]);

  function refreshWorkspace() {
    if (!tenantId) return;
    api
      .getTenant(tenantId)
      .then((response) => {
        setTenant(response.data);
        setUsage(response.usage ?? null);
      })
      .catch((error: Error) =>
        setWorkspaceMessage({ type: "error", text: error.message }),
      );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <DashboardPanel
        title="Profile"
        description="View your account details and security settings."
        bodyClassName="space-y-6"
      >
        {user ? (
          <ProfileSection key={user.userId} user={user} />
        ) : (
          <p className="text-sm text-[#64748B]">Sign in to view profile details.</p>
        )}
      </DashboardPanel>

      <DashboardPanel title="Workspace" description="Plan, usage limits, and organization details.">
        <WorkspaceSection
          tenantId={tenantId}
          user={user}
          tenant={tenant}
          usage={usage}
          workspaceMessage={workspaceMessage}
          onRefresh={refreshWorkspace}
        />
      </DashboardPanel>

      <Card className="xl:col-span-2">
        <p className="text-lg font-semibold text-[#0F172A]">Quick links</p>
        <p className="mt-1 text-sm text-[#64748B]">Jump to the most common actions across Beepr.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-[#EEF2F7] bg-[#F8FAFC] p-4 transition hover:border-[#BFDBFE] hover:bg-white"
            >
              <span className="mt-0.5 text-[#2563EB] transition group-hover:translate-x-0.5">→</span>
              <span>
                <span className="block text-sm font-semibold text-[#0F172A]">{link.label}</span>
                <span className="mt-0.5 block text-xs text-[#64748B]">{link.desc}</span>
              </span>
            </Link>
          ))}
      </div>
    </Card>
    </div>
  );
}
