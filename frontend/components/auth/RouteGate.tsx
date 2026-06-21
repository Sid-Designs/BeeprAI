"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getAuthSession,
  getNextOnboardingRoute,
  getNextOnboardingRouteIndex,
  getOnboardingPostAuthRoute,
  getOnboardingRouteIndex,
  getOnboardingState,
  isOnboardingComplete,
} from "@/lib/auth";
import { bootstrapWorkspaceSession } from "@/lib/sessionBootstrap";

type GuardMode = "public" | "auth" | "verified" | "onboarding" | "dashboard";

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function needsSessionBootstrap(mode: GuardMode, pathname: string): boolean {
  if (mode === "dashboard" || mode === "onboarding") return true;
  if (mode === "verified") return true;
  if (mode === "public" && isAuthPath(pathname) && getAuthSession()) return true;
  return false;
}

// Hydration-safe "have we mounted on the client yet?" flag. Returns false during
// SSR + the first client render, then true — without a setState-in-effect.
const subscribeNoop = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

function LoadingShell() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="h-2 w-48 overflow-hidden rounded-full bg-[#E2E8F0]">
          <div className="h-full w-20 animate-pulse rounded-full bg-[#2563EB]" />
        </div>
      </div>
    </div>
  );
}

export function RouteGate({
  mode,
  children,
}: {
  mode: GuardMode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [bootstrapped, setBootstrapped] = useState(false);

  const mounted = useSyncExternalStore(
    subscribeNoop,
    getMountedSnapshot,
    getServerMountedSnapshot,
  );

  useEffect(() => {
    if (!mounted) return;

    if (!needsSessionBootstrap(mode, pathname) || !getAuthSession()) {
      setBootstrapped(true);
      return;
    }

    let cancelled = false;
    bootstrapWorkspaceSession().finally(() => {
      if (!cancelled) setBootstrapped(true);
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, mode, pathname]);

  const decision = useMemo(() => {
    if (!mounted || !bootstrapped) {
      return { allowed: false, redirectTo: "" };
    }

    const session = getAuthSession();
    const onboarding = getOnboardingState(session?.userId);
    const complete = isOnboardingComplete(onboarding);
    const requiresAuth =
      mode === "auth" || mode === "verified" || mode === "onboarding" || mode === "dashboard";

    if (requiresAuth && !session) return { allowed: false, redirectTo: "/login" };

    if (mode === "public") {
      if (session && isAuthPath(pathname)) {
        return {
          allowed: false,
          redirectTo: getOnboardingPostAuthRoute(onboarding),
        };
      }
      return { allowed: true, redirectTo: "" };
    }

    if (mode === "auth") return { allowed: true, redirectTo: "" };

    if (!session?.verified) return { allowed: false, redirectTo: "/verify-email" };

    if (mode === "verified") {
      return { allowed: true, redirectTo: "" };
    }

    if (mode === "onboarding") {
      if (complete) return { allowed: false, redirectTo: "/dashboard" };

      const currentIndex = getOnboardingRouteIndex(pathname);
      const nextIndex = getNextOnboardingRouteIndex(onboarding);
      if (currentIndex === -1) return { allowed: false, redirectTo: getNextOnboardingRoute(onboarding) };
      if (nextIndex !== -1 && currentIndex > nextIndex) {
        return { allowed: false, redirectTo: getNextOnboardingRoute(onboarding) };
      }
      return { allowed: true, redirectTo: "" };
    }

    // Dashboard: only brand-new users (no workspace synced) see onboarding.
    if (!complete) {
      return { allowed: false, redirectTo: getNextOnboardingRoute(onboarding) };
    }
    return { allowed: true, redirectTo: "" };
  }, [mode, pathname, mounted, bootstrapped]);

  useEffect(() => {
    if (bootstrapped && !decision.allowed && decision.redirectTo) {
      router.replace(decision.redirectTo);
    }
  }, [bootstrapped, decision, router]);

  if (!mounted || !bootstrapped || !decision.allowed) {
    return <LoadingShell />;
  }

  return <>{children}</>;
}
