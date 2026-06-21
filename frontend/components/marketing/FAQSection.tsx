"use client";

import { Section, SectionHeader } from "@/components/ui/Container";
import { cn } from "@/lib/cn";

const faqs = [
  {
    q: "Do I need my own phone number?",
    a: "No. Beepr uses a shared platform caller number (Vobiz) for outbound calls. You only enter the customer's number you want to reach.",
  },
  {
    q: "What agent types are supported?",
    a: "Support, sales, appointment booking, and custom workflows. Each agent gets its own tone, script, and call configuration.",
  },
  {
    q: "How does the knowledge base work?",
    a: "Upload text, PDFs, or URLs per agent. Before and during calls, the AI retrieves relevant chunks to ground its responses.",
  },
  {
    q: "What happens after a call ends?",
    a: "Beepr runs post-call analysis — transcripts, summaries, lead scores, sentiment, and outcome classification in your dashboard.",
  },
  {
    q: "Can I manage multiple businesses?",
    a: "Yes. Beepr is multi-tenant by design. Platform admins can view all tenants, agents, and call history from the admin panel.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes — the free plan includes 1 agent and 10 calls per month. Upgrade to Pro or Enterprise when you need more volume.",
  },
];

export function FAQSection() {
  return (
    <Section id="faq" variant="white">
      <SectionHeader badge="FAQ" title="Common questions" description="Everything you need to know before getting started." />
      <div className="mx-auto max-w-2xl space-y-3">
        {faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-[#d4e3f7] bg-[#f8fbff] transition-shadow open:bg-white open:shadow-md"
          >
            <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-[#0c1a2e] marker:content-none sm:px-6">
              <span className="flex items-center justify-between gap-4">
                <span className="text-sm sm:text-base">{item.q}</span>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0ea5e9]/10 text-[#0ea5e9] transition-transform duration-200",
                    "group-open:rotate-45",
                  )}
                >
                  +
                </span>
              </span>
            </summary>
            <p className="border-t border-[#d4e3f7] px-5 py-4 text-sm leading-relaxed text-[#5b7190] sm:px-6">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
