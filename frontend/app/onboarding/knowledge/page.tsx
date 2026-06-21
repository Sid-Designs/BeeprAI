"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RouteGate } from "@/components/auth/RouteGate";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { KnowledgeUpload } from "@/components/knowledge/KnowledgeUpload";
import { Button } from "@/components/shared/Button";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import { getOnboardingState, getTenantId, updateOnboardingState } from "@/lib/auth";

export default function KnowledgeStepPage() {
  const router = useRouter();
  const state = getOnboardingState();
  const tenantId = getTenantId() || "";
  const [hasUploaded, setHasUploaded] = useState(false);
  const [error, setError] = useState("");

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={3}
        title="Upload knowledge"
        subtitle="Add business information so your AI agent can answer with confidence."
        footer={<OnboardingSkipActions stepKey="knowledgeCompleted" nextRoute="/onboarding/test" />}
      >
        <KnowledgeUpload tenantId={tenantId} agentId={state.agentId} onUploaded={() => setHasUploaded(true)} />
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              if (!hasUploaded) {
                setError("Upload at least one knowledge source before continuing.");
                return;
              }
              updateOnboardingState({ knowledgeCompleted: true });
              router.push("/onboarding/test");
            }}
          >
            Continue to testing
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-[#EF4444]">{error}</p> : null}
      </OnboardingLayout>
    </RouteGate>
  );
}
