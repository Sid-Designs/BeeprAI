"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  getServerTenantIdSnapshot,
  getTenantIdSnapshot,
  subscribeTenantId,
} from "@/lib/auth";

const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function PanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
      <div className="h-56 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
    </div>
  );
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, getMountedSnapshot, getServerMountedSnapshot);
  const tenantId = useSyncExternalStore(
    subscribeTenantId,
    getTenantIdSnapshot,
    getServerTenantIdSnapshot,
  );

  if (!mounted) return <PanelSkeleton />;

  if (!tenantId) {
    return (
      <EmptyState
        icon="workspace"
        title="Workspace not set up yet"
        description="Create your workspace from the Overview page to unlock agents, calls, knowledge, and analytics."
        cta={{ label: "Go to Overview", href: "/dashboard" }}
      />
    );
  }

  return children;
}
