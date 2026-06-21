import { ScrollProgress } from "@/components/animations/ScrollProgress";
import { CTASection } from "@/components/marketing/CTASection";
import { CapabilitiesSection } from "@/components/marketing/CapabilitiesSection";
import { DashboardPreviewSection } from "@/components/marketing/DashboardPreviewSection";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorksSection } from "@/components/marketing/HowItWorksSection";
import { IntegrationsSection } from "@/components/marketing/IntegrationsSection";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";
import { PricingTeaserSection } from "@/components/marketing/PricingTeaserSection";
import { ProductShowcaseSection } from "@/components/marketing/ProductShowcaseSection";
import { ResourcesSection } from "@/components/marketing/ResourcesSection";
import { StatsBar } from "@/components/marketing/StatsBar";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TrustBar } from "@/components/marketing/TrustBar";
import { UseCasesSection } from "@/components/marketing/UseCasesSection";

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A]">
      <ScrollProgress />
      <MarketingNavbar />
      <main className="pt-[74px]">
        <Hero />
        <TrustBar />
        <StatsBar />
        <section className="bg-gradient-to-b from-[#F8FAFC] via-[#F8FAFC] to-white">
          <ProductShowcaseSection />
          <UseCasesSection />
          <CapabilitiesSection />
          <HowItWorksSection />
          <DashboardPreviewSection />
          <IntegrationsSection />
          <PricingTeaserSection />
          <Testimonials />
          <ResourcesSection />
          <CTASection />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
