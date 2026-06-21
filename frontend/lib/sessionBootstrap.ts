"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import {
  getAuthSession,
  markOnboardingCompleteForReturningUser,
  setAuthSession,
  setTenantId,
} from "@/lib/auth";

let bootstrapInFlight: Promise<void> | null = null;

/**
 * Syncs the client session with the backend after login or on dashboard load:
 * - Refreshes user profile from /auth/me
 * - Restores tenant/workspace from /tenant/mine
 * - Marks onboarding complete for returning users who already have a workspace
 */
export async function bootstrapWorkspaceSession(): Promise<void> {
  if (bootstrapInFlight) return bootstrapInFlight;

  bootstrapInFlight = (async () => {
    const session = getAuthSession();
    if (!session) return;

    try {
      const meRes = await api.me();
      const user = meRes.data?.user;
      if (user) {
        setAuthSession({
          userId: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          organizationId: user.organizationId,
          verified: user.isEmailVerified,
          isPlatformAdmin: Boolean(user.isPlatformAdmin),
          createdAt: user.createdAt ?? session.createdAt ?? new Date().toISOString(),
        });
      }
    } catch {
      return;
    }

    const activeSession = getAuthSession();
    if (!activeSession) return;

    try {
      const tenantRes = await api.getMyTenant();
      const tenant = tenantRes.data;

      if (!tenant?._id) {
        // Brand-new user — no workspace on the server yet; keep guided onboarding.
        return;
      }

      setTenantId(tenant._id);

      const agentPatch: { agentId?: string; agentName?: string } = {};
      try {
        const agentsRes = await api.listAgents(tenant._id);
        const agents = agentsRes.data ?? [];
        if (agents[0]) {
          agentPatch.agentId = agents[0]._id;
          agentPatch.agentName = agents[0].name;
        }
      } catch {
        /* agents optional for completion */
      }

      // Existing workspace = returning user → skip onboarding on sign-in.
      markOnboardingCompleteForReturningUser(
        {
          workspaceName: tenant.orgName,
          industry: tenant.industry,
          ...agentPatch,
        },
        activeSession.userId,
      );
    } catch {
      /* No tenant on server — brand-new user keeps guided onboarding. */
    }
  })().finally(() => {
    bootstrapInFlight = null;
  });

  return bootstrapInFlight;
}

export function SessionBootstrap() {
  useEffect(() => {
    bootstrapWorkspaceSession();
  }, []);

  return null;
}
