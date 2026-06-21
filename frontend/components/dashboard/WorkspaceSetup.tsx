"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import {
  getAuthSession,
  setAuthSession,
  setTenantId,
  updateOnboardingState,
} from "@/lib/auth";
import { Button } from "@/components/shared/Button";
import { Input, Label, Select } from "@/components/shared/FormField";

const checklist = [
  "Spin up your first AI voice agent",
  "Ground answers in your business knowledge",
  "Launch outbound calls and track outcomes",
];

export function WorkspaceSetup({ onComplete }: { onComplete: (tenantId: string) => void }) {
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [industry, setIndustry] = useState("Education");
  const [teamSize, setTeamSize] = useState("1-10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Organization first so the tenant can be linked on the backend.
      let organizationId = getAuthSession()?.organizationId ?? null;
      if (!organizationId) {
        try {
          const orgRes = await api.createOrganization({ name: workspaceName, industry });
          organizationId = orgRes.data.organization._id;
          const session = getAuthSession();
          if (session) {
            setAuthSession({ ...session, organizationId });
          }
        } catch {
          /* organization may already exist for this account */
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
      onComplete(response.data._id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#DBEAFE] bg-white shadow-[0_18px_40px_rgba(37,99,235,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] p-7 text-white">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-[#38BDF8]/30 blur-2xl" />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] backdrop-blur">
            Step 1 · Get started
          </span>
          <h2 className="relative mt-5 text-2xl font-semibold leading-tight tracking-[-0.02em]">
            Create your workspace
          </h2>
          <p className="relative mt-2 text-sm text-white/85">
            Your workspace holds your agents, knowledge, calls, and analytics. It takes a few seconds
            to set up.
          </p>
          <ul className="relative mt-6 space-y-3">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-white/90">
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white/20">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <form className="grid gap-4 p-7" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input
              id="workspaceName"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Inc."
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
            <Label htmlFor="teamSize">Team size</Label>
            <Select id="teamSize" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
              <option>1-10</option>
              <option>11-50</option>
              <option>51-200</option>
              <option>200+</option>
            </Select>
          </div>
          <Button type="submit" className="shine" disabled={busy}>
            {busy ? "Creating workspace..." : "Create workspace"}
          </Button>
          {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          <p className="text-center text-xs text-[#94A3B8]">
            You can change these details anytime in Settings.
          </p>
        </form>
      </div>
    </div>
  );
}
