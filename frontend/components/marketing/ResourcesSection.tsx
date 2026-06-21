import Link from "next/link";
import { SpotlightCard } from "@/components/animations/SpotlightCard";
import { SectionFrame } from "@/components/marketing/SectionFrame";

const resources = [
  {
    title: "Setup playbook",
    body: "Learn how top teams launch Beepr in under 5 minutes.",
    href: "/resources/setup-playbook",
  },
  {
    title: "Voice automation guide",
    body: "Best practices for sales, support, booking, and reminder workflows.",
    href: "/resources/voice-automation-guide",
  },
  {
    title: "ROI calculator",
    body: "Estimate time saved and conversion impact before rollout.",
    href: "/resources/roi-calculator",
  },
];

export function ResourcesSection() {
  return (
    <SectionFrame id="resources" badge="Resources" title="Launch Faster With Practical Guides">
      <div className="grid gap-4 lg:grid-cols-3">
        {resources.map((resource) => (
          <Link key={resource.title} href={resource.href} className="block h-full">
            <SpotlightCard className="group h-full transition duration-300 hover:border-[#BFDBFE]">
              <p className="text-base font-semibold text-[#0F172A]">{resource.title}</p>
              <p className="mt-2 text-sm text-[#64748B]">{resource.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB]">
                Read more
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </SpotlightCard>
          </Link>
        ))}
      </div>
    </SectionFrame>
  );
}
