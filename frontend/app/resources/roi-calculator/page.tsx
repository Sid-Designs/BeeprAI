import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { RoiCalculatorWidget } from "@/components/marketing/RoiCalculatorWidget";
import { SectionFrame } from "@/components/marketing/SectionFrame";

export const metadata = {
  title: "ROI Calculator — Beepr",
  description: "Estimate time saved, revenue uplift, and monthly ROI before adopting AI voice calling.",
};

export default function RoiCalculatorPage() {
  return (
    <MarketingPageShell>
      <SectionFrame
        badge="Resources"
        title="ROI Calculator"
        subtitle="See whether Beepr pays for itself based on your call volume, team costs, and conversion rates."
        className="pb-16"
      >
        <RoiCalculatorWidget />
      </SectionFrame>
    </MarketingPageShell>
  );
}
