import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { SectionFrame } from "@/components/marketing/SectionFrame";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";

export const metadata = {
  title: "Voice Automation Guide — Beepr",
  description: "Best practices for sales, support, booking, and reminder workflows with AI voice agents.",
};

const workflows = [
  {
    title: "Sales outreach",
    icon: "📞",
    steps: [
      "Upload your product FAQ, pricing sheet, and objection-handling scripts to the knowledge base.",
      "Configure a sales agent with a confident, concise tone and a clear call-to-action.",
      "Run a test call to verify the agent handles common objections before bulk dialing.",
      "Review post-call lead scores and outcomes in Analytics to refine your script.",
    ],
    metric: "Teams report 15–25% higher connect-to-meeting rates with consistent AI follow-ups.",
  },
  {
    title: "Appointment booking",
    icon: "📅",
    steps: [
      "Set working hours, slot length, and timezone in Calendar settings.",
      "Train the agent on services offered, duration, and booking policies.",
      "Enable the appointment flow so the agent can check availability live on calls.",
      "Confirm bookings appear in your dashboard calendar after each successful call.",
    ],
    metric: "Reduces no-shows by sending verbal confirmations and capturing preferred times.",
  },
  {
    title: "Customer support",
    icon: "🎧",
    steps: [
      "Add support docs, return policies, and troubleshooting guides to knowledge.",
      "Use a calm, empathetic tone with escalation phrases for complex issues.",
      "Route unresolved calls by capturing callback numbers and issue summaries.",
      "Track sentiment and resolution outcomes in call history.",
    ],
    metric: "Handles tier-1 queries 24/7 while your team focuses on complex cases.",
  },
  {
    title: "Reminders & follow-ups",
    icon: "⏰",
    steps: [
      "Import or dial reminder lists via bulk campaigns.",
      "Keep scripts short — confirm appointment, offer reschedule, thank the customer.",
      "Use Pro or Enterprise for higher monthly call volume on reminder batches.",
      "Monitor completion rates and adjust call windows for best pickup times.",
    ],
    metric: "Automated reminders cut manual dialing time by up to 85%.",
  },
];

export default function VoiceAutomationGuidePage() {
  return (
    <MarketingPageShell>
      <SectionFrame
        badge="Resources"
        title="Voice Automation Guide"
        subtitle="Proven workflows for admissions, sales, appointments, and customer support — powered by Beepr AI agents."
        className="pb-8"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {workflows.map((workflow) => (
            <Card key={workflow.title} className="flex flex-col p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EFF6FF] text-xl">
                  {workflow.icon}
                </span>
                <h3 className="text-lg font-semibold text-[#0F172A]">{workflow.title}</h3>
              </div>
              <ol className="mt-5 flex-1 space-y-3">
                {workflow.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#475569]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-xs font-semibold text-[#2563EB]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs text-[#1E40AF]">
                {workflow.metric}
              </p>
            </Card>
          ))}
        </div>
      </SectionFrame>

      <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-[#0F172A]">Optimize your rollout</h2>
          <p className="mt-3 text-[#64748B]">
            Use the ROI calculator to estimate savings before scaling, then pick the plan that matches
            your monthly call volume.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/resources/roi-calculator" className="shine">
              Calculate ROI
            </Button>
            <Button href="/pricing" variant="secondary">
              View pricing
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12 text-center text-sm text-[#94A3B8]">
        <Link href="/resources/setup-playbook" className="text-[#2563EB] hover:underline">
          ← Setup playbook
        </Link>
        {" · "}
        <Link href="/resources/roi-calculator" className="text-[#2563EB] hover:underline">
          ROI calculator →
        </Link>
      </section>
    </MarketingPageShell>
  );
}
