import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { SectionFrame } from "@/components/marketing/SectionFrame";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { onboardingSteps } from "@/lib/content";

export const metadata = {
  title: "Setup Playbook — Beepr",
  description: "Launch your first AI voice agent in under 5 minutes with this step-by-step playbook.",
};

const tips = [
  {
    title: "Pick the right agent template",
    body: "Start with sales or appointment booking if you're doing outbound. Support works best for inbound-style callbacks.",
  },
  {
    title: "Keep knowledge chunks focused",
    body: "Upload FAQs, pricing, and policies as separate text blocks. Shorter, topic-specific entries improve answer accuracy.",
  },
  {
    title: "Test before bulk campaigns",
    body: "Use the test call step in onboarding to verify tone, booking flow, and knowledge retrieval before dialing leads.",
  },
  {
    title: "Set realistic call limits",
    body: "Free plan includes 10 calls/month. Upgrade to Pro when you exceed 200 monthly outbound conversations.",
  },
];

export default function SetupPlaybookPage() {
  return (
    <MarketingPageShell>
      <SectionFrame
        badge="Resources"
        title="Setup Playbook"
        subtitle="Everything you need to go from signup to your first live outbound call — typically under 5 minutes."
        className="pb-8"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {onboardingSteps.map((step) => (
            <Card key={step.step} className="p-6">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB]">
                Step {step.step}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-[#0F172A]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{step.copy}</p>
              <span className="mt-4 inline-block rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#2563EB]">
                {step.tag}
              </span>
            </Card>
          ))}
        </div>
      </SectionFrame>

      <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-semibold text-[#0F172A]">Pro tips from successful teams</h2>
          <div className="accent-line mt-4" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {tips.map((tip) => (
              <Card key={tip.title} className="p-5">
                <h3 className="font-semibold text-[#0F172A]">{tip.title}</h3>
                <p className="mt-2 text-sm text-[#64748B]">{tip.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-[#0F172A]">Ready to launch?</h2>
        <p className="mx-auto mt-3 max-w-lg text-[#64748B]">
          Create your workspace and follow the guided onboarding — we walk you through every step.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button href="/signup" className="shine">
            Start free
          </Button>
          <Button href="/onboarding/workspace" variant="secondary">
            Open guided setup
          </Button>
        </div>
        <p className="mt-6 text-sm text-[#94A3B8]">
          <Link href="/resources/voice-automation-guide" className="text-[#2563EB] hover:underline">
            Next: Voice automation guide →
          </Link>
        </p>
      </section>
    </MarketingPageShell>
  );
}
