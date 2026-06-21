import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { SectionFrame } from "@/components/marketing/SectionFrame";

export const metadata = {
  title: "Privacy Policy — Beepr",
  description: "How Beepr collects, uses, and protects your data.",
};

const sections = [
  {
    title: "Information we collect",
    body: "We collect account details (name, email, phone), workspace configuration, call transcripts, and usage metrics necessary to operate the AI voice calling platform.",
  },
  {
    title: "How we use your data",
    body: "Your data powers voice agent responses, post-call analytics, billing, and product improvements. Knowledge base content is used only to ground your agents' replies.",
  },
  {
    title: "Call recordings & transcripts",
    body: "Call audio and transcripts are stored securely for your workspace. You can access them from your dashboard. We do not sell call data to third parties.",
  },
  {
    title: "Third-party services",
    body: "Beepr integrates with telephony, payment (Razorpay), and AI providers to deliver the service. These partners process data under their own privacy policies and our data processing agreements.",
  },
  {
    title: "Data retention",
    body: "Account data is retained while your account is active. You may request deletion by contacting support. Some records may be kept as required by law.",
  },
  {
    title: "Your rights",
    body: "You can access, correct, or delete your personal data by contacting us. EU and Indian users may have additional rights under applicable privacy laws.",
  },
  {
    title: "Contact",
    body: "For privacy questions, email privacy@beepr.ai or reach out through your dashboard support channel.",
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <SectionFrame
        badge="Legal"
        title="Privacy Policy"
        subtitle={`Last updated: ${new Date().toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}`}
        className="pb-16"
      >
        <div className="mx-auto max-w-3xl space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-[#0F172A]">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{section.body}</p>
            </div>
          ))}
          <p className="border-t border-[#E2E8F0] pt-8 text-sm text-[#94A3B8]">
            <Link href="/terms" className="text-[#2563EB] hover:underline">
              Terms of Service →
            </Link>
          </p>
        </div>
      </SectionFrame>
    </MarketingPageShell>
  );
}
