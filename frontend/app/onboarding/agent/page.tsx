"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RouteGate } from "@/components/auth/RouteGate";
import { FloatingElement } from "@/components/animations/FloatingElement";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Label, Select } from "@/components/shared/FormField";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import { getOnboardingState, getTenantId, updateOnboardingState } from "@/lib/auth";
import { AGENT_TYPE_OPTIONS, DEFAULT_TONE, TONE_OPTIONS, isAgentType, toneLabel } from "@/lib/agentOptions";
import type { AgentType } from "@/lib/types";

export default function AgentStepPage() {
  const router = useRouter();
  const state = getOnboardingState();
  const tenantId = getTenantId();
  const [name, setName] = useState(state.agentName || "Beepr Sales Agent");
  const [role, setRole] = useState<AgentType>("sales");
  const [voice, setVoice] = useState("Professional");
  const [tone, setTone] = useState(DEFAULT_TONE.sales);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // When the role changes, snap the tone to a value valid for that type.
  const handleRoleChange = (value: string) => {
    if (!isAgentType(value)) return;
    setRole(value);
    if (!TONE_OPTIONS[value].includes(tone)) {
      setTone(DEFAULT_TONE[value]);
    }
  };

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={1}
        title="Create AI agent"
        subtitle="Define your agent identity, voice, and call behavior."
        footer={<OnboardingSkipActions stepKey="agentCompleted" nextRoute="/onboarding/calendar" />}
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!tenantId) {
                setError("Workspace session missing. Return to workspace setup.");
                return;
              }
              setBusy(true);
              try {
                const response = await api.createAgent({
                  tenantId,
                  name,
                  type: role,
                  tone,
                  script: `Voice: ${voice}. Tone: ${tone}. Role: ${role}.`,
                  callConfig: { objective: "lead_generation" },
                });
                updateOnboardingState({
                  agentCompleted: true,
                  agentId: response.data._id,
                  agentName: name,
                });
                router.push("/onboarding/calendar");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" value={role} onChange={(e) => handleRoleChange(e.target.value)}>
                {AGENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="voice">Voice</Label>
              <Select id="voice" value={voice} onChange={(e) => setVoice(e.target.value)}>
                <option>Professional</option>
                <option>Warm</option>
                <option>Concise</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONE_OPTIONS[role].map((value) => (
                  <option key={value} value={value}>
                    {toneLabel(value)}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating..." : "Continue to bookings"}
            </Button>
            {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          </form>

          <FloatingElement>
            <Card>
              <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">Agent preview</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                  AI
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A]">{name}</p>
                  <p className="text-xs text-[#64748B]">
                    {voice} · {toneLabel(tone)}
                  </p>
                </div>
              </div>
            </Card>
          </FloatingElement>
        </div>
      </OnboardingLayout>
    </RouteGate>
  );
}
