"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { DashboardContentTransition } from "@/components/dashboard/DashboardContentTransition";
import { ProfileMenu } from "@/components/dashboard/ProfileMenu";
import { api } from "@/lib/api";
import {
  clearAuthSession,
  clearTenantId,
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  subscribeAuthSession,
} from "@/lib/auth";
import { cn } from "@/lib/cn";

function initialsFromName(name: string) {
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

const iconClass = "h-[18px] w-[18px] flex-none";

type NavItem = { href: string; label: string; icon: ReactNode };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4v9zm10 7h6v-9h-6v9zM4 20h6v-4H4v4zM14 4v4h6V4h-6z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/agents",
        label: "Agents",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a6 6 0 016-6h6a6 6 0 016 6v1" />
          </svg>
        ),
      },
      {
        href: "/dashboard/calls",
        label: "Calls",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.68l1.2 3.6a1 1 0 01-.5 1.2L7.5 9.6a12 12 0 006.9 6.9l1.12-1.75a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.6 21 3 14.4 3 6V5z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/bulk-calls",
        label: "Bulk calling",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12M8 12h12M8 17h8M4 7h.01M4 12h.01M4 17h.01" />
          </svg>
        ),
      },
      {
        href: "/dashboard/calendar",
        label: "Bookings",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        href: "/dashboard/knowledge",
        label: "Knowledge",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6M8 13h8M8 17h5" />
          </svg>
        ),
      },
      {
        href: "/dashboard/analytics",
        label: "Analytics",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m0 14h16M8 16v-4m4 4V8m4 8v-6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.3a1 1 0 011.4 0l.9.9a1 1 0 00.9.27l1.24-.25a1 1 0 011.18.83l.2 1.25a1 1 0 00.55.73l1.13.56a1 1 0 01.5 1.27l-.45 1.18a1 1 0 000 .92l.45 1.18a1 1 0 01-.5 1.27l-1.13.56a1 1 0 00-.55.73l-.2 1.25a1 1 0 01-1.18.83l-1.24-.25a1 1 0 00-.9.27l-.9.9a1 1 0 01-1.4 0l-.9-.9a1 1 0 00-.9-.27l-1.24.25a1 1 0 01-1.18-.83l-.2-1.25a1 1 0 00-.55-.73l-1.13-.56a1 1 0 01-.5-1.27l.45-1.18a1 1 0 000-.92L3.4 9.12a1 1 0 01.5-1.27l1.13-.56a1 1 0 00.55-.73l.2-1.25a1 1 0 011.18-.83l1.24.25a1 1 0 00.9-.27l.9-.9z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        ),
      },
    ],
  },
];

const adminNavItem: NavItem = {
  href: "/dashboard/admin",
  label: "Platform admin",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={iconClass}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.4-3.1 8.5-7 9-3.9-.5-7-4.6-7-9V7l7-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
};

function buildNavGroups(isPlatformAdmin: boolean) {
  const groups = [...navGroups];
  if (isPlatformAdmin) {
    groups.push({
      label: "Platform",
      items: [adminNavItem],
    });
  }
  return groups;
}

function getAllNavItems(isPlatformAdmin: boolean) {
  return buildNavGroups(isPlatformAdmin).flatMap((group) => group.items);
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const user = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );

  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
  const sidebarGroups = buildNavGroups(isPlatformAdmin);
  const allNavItems = getAllNavItems(isPlatformAdmin);

  const activeItem =
    [...allNavItems].sort((a, b) => b.href.length - a.href.length).find((item) => isActive(pathname, item.href)) ??
    allNavItems[0];

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      /* logout is best-effort; clear local state regardless */
    }
    clearAuthSession();
    clearTenantId();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-[74px] max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="group flex items-center gap-2.5">
              <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] transition-transform duration-300 group-hover:scale-105">
                <span className="text-base font-bold">B</span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#38BDF8] ring-2 ring-white">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[#38BDF8] opacity-75" />
                </span>
              </span>
              <span className="text-sm font-semibold text-[#0F172A]">Beepr</span>
            </Link>
            <span className="hidden items-center gap-2 text-sm text-[#94A3B8] md:flex">
              <span className="text-[#CBD5E1]">/</span>
              <span className="font-medium text-[#475569]">{activeItem.label}</span>
            </span>
            {isPlatformAdmin && pathname.startsWith("/dashboard/admin") ? (
              <span className="hidden rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB] sm:inline-flex">
                Platform admin
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#DCFCE7] bg-[#F0FDF4] px-2.5 py-1 text-xs font-medium text-[#16A34A] sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
              </span>
              Operational
            </span>
            <button
              type="button"
              aria-label="Notifications"
              className="relative hidden h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#475569] transition hover:border-[#CBD5E1] hover:bg-[#F8FAFC] sm:inline-flex"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.42V11a6 6 0 10-12 0v3.18a2 2 0 01-.6 1.42L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            </button>
            {user ? <ProfileMenu user={user} onLogout={handleLogout} /> : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-8 lg:grid-cols-[256px_1fr]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[96px] lg:h-fit">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
            {sidebarGroups.map((group) => (
              <div key={group.label} className="mb-2 last:mb-0">
                <p className="mb-1.5 px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                  {group.label}
                </p>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200",
                          active
                            ? "bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white shadow-[0_8px_18px_rgba(37,99,235,0.25)]"
                            : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]",
                        )}
                      >
                        <span className={cn("transition", active ? "text-white" : "text-[#94A3B8] group-hover:text-[#2563EB]")}>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {user ? (
            <Link
              href="/dashboard/settings"
              className="group flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_10px_25px_rgba(15,23,42,0.04)] transition hover:border-[#BFDBFE]"
            >
              <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-sm font-semibold text-white">
                {initialsFromName(user.fullName)}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold text-[#0F172A]">{user.fullName}</span>
                <span className="block truncate text-xs text-[#94A3B8]">{roleLabels[user.role] ?? user.role}</span>
              </span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="ml-auto h-4 w-4 flex-none text-[#CBD5E1] transition group-hover:text-[#2563EB]">
                <path fillRule="evenodd" d="M7.3 5.3a1 1 0 011.4 0l4 4a1 1 0 010 1.4l-4 4a1 1 0 01-1.4-1.4L10.6 10 7.3 6.7a1 1 0 010-1.4z" clipRule="evenodd" />
              </svg>
            </Link>
          ) : null}

          <div className="rounded-2xl border border-[#DBEAFE] bg-gradient-to-br from-[#EFF6FF] to-white p-4">
            <p className="text-sm font-semibold text-[#0F172A]">Need a hand?</p>
            <p className="mt-1 text-xs text-[#64748B]">Explore guides to launch faster.</p>
            <Link
              href="/resources/setup-playbook"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] transition hover:gap-1.5"
            >
              View resources
              <span aria-hidden>→</span>
            </Link>
          </div>
        </aside>

        <main className="min-w-0 isolate">
          <DashboardContentTransition>{children}</DashboardContentTransition>
        </main>
      </div>
    </div>
  );
}

export function DashboardLayout({
  children,
  heading,
  description,
}: {
  children: ReactNode;
  heading: string;
  description?: string;
}) {
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-[#0F172A]">{heading}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-[#64748B]">{description}</p> : null}
        <div className="accent-line mt-3" />
      </header>
      {children}
    </div>
  );
}
