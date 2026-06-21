import { Button } from "@/components/shared/Button";
import { SectionFrame } from "@/components/marketing/SectionFrame";
import { PricingPlansGrid } from "@/components/marketing/PricingPlansGrid";

export function PricingTeaserSection() {
  return (
    <SectionFrame
      id="pricing"
      align="center"
      badge="Pricing"
      title="Plans for Every Growth Stage"
      subtitle="Start free with 10 calls per month. Upgrade when your outbound volume grows — all plans include platform telephony."
    >
      <PricingPlansGrid />

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button href="/pricing" variant="ghost">
          Compare all plans →
        </Button>
        <Button href="/resources/roi-calculator" variant="secondary" size="sm">
          Calculate your ROI
        </Button>
      </div>
    </SectionFrame>
  );
}
