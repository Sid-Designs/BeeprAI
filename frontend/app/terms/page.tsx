import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { SectionFrame } from "@/components/marketing/SectionFrame";

export const metadata = {
  title: "Terms of Service — Beepr",
  description: "Terms governing use of the Beepr AI voice calling platform.",
};

const sections = [
  {
    title: "Acceptance of terms",
    body: "By creating an account or using Beepr, you agree to these Terms of Service and our Privacy Policy. If you use Beepr on behalf of an organization, you represent that you have authority to bind that organization.",
  },
  {
    title: "Service description",
    body: "Beepr provides AI-powered voice calling, knowledge management, analytics, and related tools. Features and limits depend on your plan (Free, Pro, or Enterprise).",
  },
  {
    title: "Account responsibilities",
    body: "You are responsible for maintaining account security, complying with applicable telemarketing and privacy laws, and ensuring you have consent to call the numbers you dial.",
  },
  {
    title: "Acceptable use",
    body: "You may not use Beepr for spam, harassment, illegal activities, or calls without proper consent. We may suspend accounts that violate these rules.",
  },
  {
    title: "Plans & billing",
    body: "Paid plans are billed monthly via Razorpay. Upgrades take effect after payment verification. Plan limits (calls, agents) reset monthly. Refunds are handled case-by-case — contact support within 7 days of purchase.",
  },
  {
    title: "Intellectual property",
    body: "Beepr retains ownership of the platform. You retain ownership of your knowledge base content, call data, and business materials uploaded to the service.",
  },
  {
    title: "Limitation of liability",
    body: "Beepr is provided as-is. We are not liable for indirect damages, lost revenue, or call outcomes. Our total liability is limited to fees paid in the prior 12 months.",
  },
  {
    title: "Changes & termination",
    body: "We may update these terms with notice. You may cancel anytime; we may terminate accounts for violations. Upon termination, access to your workspace ends per our data retention policy.",
  },
  {
    title: "Contact",
    body: "Questions about these terms: legal@beepr.ai",
  },
];

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <SectionFrame
        badge="Legal"
        title="Terms of Service"
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
            <Link href="/privacy" className="text-[#2563EB] hover:underline">
              ← Privacy Policy
            </Link>
          </p>
        </div>
      </SectionFrame>
    </MarketingPageShell>
  );
}
