import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { PricingPlansGrid } from "@/components/marketing/PricingPlansGrid";
import { SectionFrame } from "@/components/marketing/SectionFrame";
import { planCatalog } from "@/lib/plans";

const comparisonRows: Array<
  | { label: string; type: "numeric"; key: "calls" | "agents" }
  | { label: string; type: "text"; values: [string, string, string] }
> = [
  { label: "Monthly calls", type: "numeric", key: "calls" },
  { label: "AI agents", type: "numeric", key: "agents" },
  {
    label: "Knowledge base",
    type: "text",
    values: ["Text only", "Text, PDF & URL", "Text, PDF & URL"],
  },
  {
    label: "Post-call analytics",
    type: "text",
    values: ["Summaries", "Lead scoring & outcomes", "Full analytics suite"],
  },
  {
    label: "Support",
    type: "text",
    values: ["Community", "Priority", "Dedicated onboarding"],
  },
];

export const metadata = {
  title: "Pricing — Beepr",
  description: "Simple INR pricing for AI voice calling. Free, Pro, and Enterprise plans.",
};

export default function PricingPage() {
  const plans = Object.values(planCatalog);

  return (
    <MarketingPageShell>
      <SectionFrame
        align="center"
        badge="Pricing"
        title="Simple plans that scale with your calls"
        subtitle="All plans include platform telephony. Pay once per month via Razorpay — no hidden fees."
        className="pb-12"
      >
        <PricingPlansGrid />
      </SectionFrame>

      <section className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-[#0F172A]">
            Plan comparison
          </h2>
          <div className="accent-line mx-auto mt-4" />

          <div className="mt-10 overflow-x-auto rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                  <th className="px-5 py-4 font-semibold text-[#64748B]">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.label} className="px-5 py-4 font-semibold text-[#0F172A]">
                      {plan.label}
                      <span className="mt-1 block text-xs font-normal text-[#94A3B8]">
                        {plan.price === "0"
                          ? "Free"
                          : `₹${Number(plan.price).toLocaleString("en-IN")}/mo`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-[#F1F5F9] last:border-0">
                    <td className="px-5 py-3.5 font-medium text-[#334155]">{row.label}</td>
                    {row.type === "numeric" ? (
                      plans.map((plan) => (
                        <td key={plan.label} className="px-5 py-3.5 text-[#64748B]">
                          {plan[row.key]}
                        </td>
                      ))
                    ) : (
                      row.values.map((value, i) => (
                        <td key={i} className="px-5 py-3.5 text-[#64748B]">
                          {value}
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-[#64748B]">
              Not sure which plan fits?{" "}
              <Link href="/resources/roi-calculator" className="font-semibold text-[#2563EB]">
                Try our ROI calculator
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold text-[#0F172A]">Common questions</h2>
        <div className="accent-line mx-auto mt-4" />
        <div className="mt-8 space-y-3">
          {[
            {
              q: "Do I need my own phone number?",
              a: "No. Beepr uses a shared platform caller number for outbound calls.",
            },
            {
              q: "Is payment recurring?",
              a: "Plans are billed monthly via Razorpay. You can upgrade anytime from Settings.",
            },
            {
              q: "Can I start on the free plan?",
              a: "Yes — 1 agent and 10 calls per month, no credit card required.",
            },
          ].map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-[#E2E8F0] bg-white px-5 py-4 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none font-medium text-[#0F172A] marker:hidden [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
