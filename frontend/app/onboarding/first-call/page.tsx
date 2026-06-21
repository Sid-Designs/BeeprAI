"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RouteGate } from "@/components/auth/RouteGate";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Label } from "@/components/shared/FormField";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import { getOnboardingState, getTenantId, updateOnboardingState } from "@/lib/auth";

export default function FirstCallStepPage() {
  const router = useRouter();
  const state = getOnboardingState();
  const tenantId = getTenantId() || "";
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={5}
        title="Make first call"
        subtitle="Start your first outbound call and finish onboarding."
        footer={<OnboardingSkipActions stepKey="firstCallCompleted" nextRoute="/dashboard" />}
      >
        <Card>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="phone">Customer phone number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <Button
              disabled={busy || !phoneNumber}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await api.startCall({
                    tenantId,
                    agentId: state.agentId,
                    receiverNumber: phoneNumber,
                    triggerOutboundCall: true,
                    autoJoinCaller: true,
                    callObjective: "lead_generation",
                    callConfig: {},
                  });
                  updateOnboardingState({ firstCallCompleted: true });
                  setSuccess(true);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Starting call..." : "Start first call"}
            </Button>
          </div>
        </Card>

        {success ? (
          <Card className="mt-4 border-[#BBF7D0] bg-[#F0FDF4]">
            <p className="text-lg font-semibold text-[#14532D]">Setup complete 🎉</p>
            <p className="mt-2 text-sm text-[#166534]">Your first call has started and your workspace is now active.</p>
            <div className="mt-4">
              <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
            </div>
          </Card>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[#EF4444]">{error}</p> : null}
      </OnboardingLayout>
    </RouteGate>
  );
}
