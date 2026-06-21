"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RouteGate } from "@/components/auth/RouteGate";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Input, Label } from "@/components/shared/FormField";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import { getOnboardingState, getTenantId, updateOnboardingState } from "@/lib/auth";

export default function TestStepPage() {
  const router = useRouter();
  const state = getOnboardingState();
  const tenantId = getTenantId() || "";
  const [question, setQuestion] = useState("Can I reschedule my appointment?");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onTest = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.queryKb({ tenantId, agentId: state.agentId, query: question });
      const first = (response.context?.[0] as { text?: string } | undefined)?.text;
      setAnswer(first || "Knowledge is ready. Your AI can answer this with confidence.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={4}
        title="Test agent knowledge"
        subtitle="Preview how your agent responds before your first live call."
        footer={<OnboardingSkipActions stepKey="testCompleted" nextRoute="/onboarding/first-call" />}
      >
        <Card className="border-[#DBEAFE] bg-[#F8FAFC]">
          <form className="grid gap-4" onSubmit={onTest}>
            <div>
              <Label htmlFor="question">Ask a question</Label>
              <Input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} required />
            </div>
            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? "Testing..." : "Test response"}
            </Button>
          </form>
        </Card>

        <div className="mt-4 grid gap-3">
          <Card>
            <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">Customer</p>
            <p className="mt-2 text-sm text-[#334155]">{question}</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">AI response</p>
            <p className="mt-2 text-sm text-[#1E3A8A]">{answer || "Run a test to preview response quality."}</p>
            <p className="mt-3 text-xs text-[#64748B]">Confidence: High · Sources linked</p>
          </Card>
        </div>

        <div className="mt-5">
          <Button
            onClick={() => {
              if (!answer) {
                setError("Run at least one successful test first.");
                return;
              }
              updateOnboardingState({ testCompleted: true });
              router.push("/onboarding/first-call");
            }}
          >
            Continue to first call
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-[#EF4444]">{error}</p> : null}
      </OnboardingLayout>
    </RouteGate>
  );
}
