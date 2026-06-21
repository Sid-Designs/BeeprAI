"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  subscribeAuthSession,
} from "@/lib/auth";

const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function PlatformAdminGate({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, getMountedSnapshot, getServerMountedSnapshot);
  const session = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );
  const router = useRouter();
  const allowed = Boolean(session?.isPlatformAdmin);

  useEffect(() => {
    if (mounted && session && !allowed) {
      router.replace("/dashboard");
    }
  }, [mounted, session, allowed, router]);

  if (!mounted || !session || !allowed) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl border border-[#E2E8F0] bg-white" />
      </div>
    );
  }

  return children;
}
