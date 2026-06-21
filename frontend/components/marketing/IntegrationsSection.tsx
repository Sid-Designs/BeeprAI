import { SpotlightCard } from "@/components/animations/SpotlightCard";
import { SectionFrame } from "@/components/marketing/SectionFrame";

const integrations = [
  { name: "HubSpot", mark: "H" },
  { name: "Salesforce", mark: "S" },
  { name: "Slack", mark: "SL" },
  { name: "Google Calendar", mark: "G" },
  { name: "Zapier", mark: "Z" },
  { name: "Notion", mark: "N" },
];

export function IntegrationsSection() {
  return (
    <SectionFrame
      id="integrations"
      align="center"
      badge="Integrations"
      title="Connected to Your Workflow"
      subtitle="Works with tools your team already uses."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <SpotlightCard key={integration.name} tilt={false} className="group p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#EFF6FF] text-xs font-semibold text-[#2563EB] transition duration-300 group-hover:bg-[#2563EB] group-hover:text-white">
                {integration.mark}
              </span>
              <p className="text-base font-semibold text-[#0F172A]">{integration.name}</p>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-xs font-medium text-[#059669]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Ready
              </span>
            </div>
            <p className="mt-2 text-sm text-[#64748B] transition group-hover:text-[#334155]">
              One-click sync for conversation outcomes and contacts.
            </p>
          </SpotlightCard>
        ))}
      </div>
    </SectionFrame>
  );
}
