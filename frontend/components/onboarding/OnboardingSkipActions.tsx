"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/Button";
import {
  skipEntireOnboarding,
  skipOnboardingStep,
  type OnboardingStepKey,
} from "@/lib/auth";

export function OnboardingSkipActions({
  stepKey,
  nextRoute,
}: {
  stepKey: OnboardingStepKey;
  nextRoute: string;
}) {
  const router = useRouter();

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-[#F1F5F9] pt-5 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          skipOnboardingStep(stepKey);
          router.push(nextRoute);
        }}
      >
        Skip this step
      </Button>
      <button
        type="button"
        onClick={() => {
          skipEntireOnboarding();
          router.push("/dashboard");
        }}
        className="text-sm font-medium text-[#64748B] transition hover:text-[#2563EB]"
      >
        Skip setup and go to dashboard →
      </button>
    </div>
  );
}

export function OnboardingWelcomeLink() {
  return (
    <p className="mt-4 text-center text-sm text-[#94A3B8]">
      Need to finish later?{" "}
      <Link href="/dashboard" className="font-medium text-[#2563EB] hover:underline">
        Open dashboard
      </Link>
    </p>
  );
}
