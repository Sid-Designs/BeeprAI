"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RouteGate } from "@/components/auth/RouteGate";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Label, Select } from "@/components/shared/FormField";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import {
  getAuthSession,
  getOnboardingState,
  setAuthSession,
  setTenantId,
  updateOnboardingState,
} from "@/lib/auth";

export default function WorkspaceStepPage() {
  const router = useRouter();
  const existing = getOnboardingState();
  const [workspaceName, setWorkspaceName] = useState(existing.workspaceName || "Beepr Workspace");
  const [industry, setIndustry] = useState(existing.industry || "Education");
  const [teamSize, setTeamSize] = useState(existing.teamSize || "1-10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={0}
        title="Workspace setup"
        subtitle="Set up your business context before creating your first AI voice agent."
        footer={
          <OnboardingSkipActions stepKey="workspaceCompleted" nextRoute="/onboarding/agent" />
        }
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                const session = getAuthSession();
                if (!session?.organizationId) {
                  try {
                    const orgRes = await api.createOrganization({ name: workspaceName, industry });
                    if (session) {
                      setAuthSession({
                        ...session,
                        organizationId: orgRes.data.organization._id,
                      });
                    }
                  } catch {
                    /* organization may already exist */
                  }
                }

                const response = await api.registerTenant({ orgName: workspaceName, industry });
                setTenantId(response.data._id);

                updateOnboardingState({
                  workspaceCompleted: true,
                  workspaceName,
                  industry,
                  teamSize,
                });
                router.push("/onboarding/agent");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="workspaceName">Workspace Name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option>Healthcare</option>
                <option>Real Estate</option>
                <option>Education</option>
                <option>Insurance</option>
                <option>Recruitment</option>
                <option>Hospitality</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="teamSize">Team Size</Label>
              <Select id="teamSize" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>200+</option>
              </Select>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Continue to agent setup"}
            </Button>
            {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          </form>

          <Card>
            <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">Live preview</p>
            <p className="mt-3 text-base font-semibold text-[#0F172A]">{workspaceName || "Your workspace"}</p>
            <p className="mt-1 text-sm text-[#64748B]">{industry || "Industry"}</p>
            <p className="mt-1 text-sm text-[#64748B]">Team size: {teamSize}</p>
          </Card>
        </div>
      </OnboardingLayout>
    </RouteGate>
  );
}
