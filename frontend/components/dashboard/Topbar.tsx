"use client";

import { Button } from "@/components/shared/Button";
import { clearAuthSession, clearTenantId } from "@/lib/auth";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-[1400px] items-center justify-between px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">Beepr</p>
          <p className="text-sm font-semibold text-[#0F172A]">Workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Button href="/" variant="secondary" size="sm">
            Marketing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearAuthSession();
              clearTenantId();
              window.location.href = "/login";
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
