"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "@/lib/auth";
import { cn } from "@/lib/cn";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agentManager: "Agent Manager",
  viewer: "Viewer",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileMenu({
  user,
  onLogout,
}: {
  user: AuthSession;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition",
          open
            ? "border-[#BFDBFE] bg-[#EFF6FF]"
            : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
        )}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-[11px] font-semibold text-white">
          {initials(user.fullName)}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block max-w-[120px] truncate text-xs font-semibold text-[#0F172A]">
            {user.fullName}
          </span>
          <span className="block text-[11px] text-[#94A3B8]">{roleLabels[user.role] ?? user.role}</span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn("h-4 w-4 text-[#94A3B8] transition-transform", open && "rotate-180")}
        >
          <path
            fillRule="evenodd"
            d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.14)]"
        >
          <div className="flex items-center gap-3 border-b border-[#EEF2F7] bg-gradient-to-br from-[#EFF6FF] to-white px-4 py-3.5">
            <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-sm font-semibold text-white">
              {initials(user.fullName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0F172A]">{user.fullName}</p>
              <p className="truncate text-xs text-[#64748B]">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
              {roleLabels[user.role] ?? user.role}
            </span>
            {user.verified ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-semibold text-[#16A34A]">
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">
                Unverified
              </span>
            )}
          </div>

          <div className="border-t border-[#EEF2F7] p-1.5">
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F1F5F9]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] text-[#94A3B8]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 3.3a1 1 0 011.4 0l.7.7a1 1 0 00.9.28l1-.2a1 1 0 011.18.83l.16 1a1 1 0 00.55.73l.9.45a1 1 0 01.5 1.27l-.36.95a1 1 0 000 .72l.36.95a1 1 0 01-.5 1.27l-.9.45a1 1 0 00-.55.73l-.16 1a1 1 0 01-1.18.83l-1-.2a1 1 0 00-.9.28l-.7.7a1 1 0 01-1.4 0l-.7-.7a1 1 0 00-.9-.28l-1 .2a1 1 0 01-1.18-.83l-.16-1a1 1 0 00-.55-.73l-.9-.45a1 1 0 01-.5-1.27l.36-.95a1 1 0 000-.72l-.36-.95a1 1 0 01.5-1.27l.9-.45a1 1 0 00.55-.73l.16-1a1 1 0 011.18-.83l1 .2a1 1 0 00.9-.28l.7-.7z" />
                <circle cx="12" cy="12" r="2.4" />
              </svg>
              Settings
            </Link>
            {user.isPlatformAdmin ? (
              <Link
                href="/dashboard/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F1F5F9]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] text-[#94A3B8]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 4.4-3.1 8.5-7 9-3.9-.5-7-4.6-7-9V7l7-4z" />
                </svg>
                Platform admin
              </Link>
            ) : null}
            <Link
              href="/"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#F1F5F9]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] text-[#94A3B8]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10" />
              </svg>
              Back to site
            </Link>
          </div>

          <div className="border-t border-[#EEF2F7] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#DC2626] transition hover:bg-[#FEF2F2]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H4m0 0l4-4m-4 4l4 4M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
