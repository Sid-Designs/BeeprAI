import { ParallaxSection } from "@/components/animations/ParallaxSection";
import { Button } from "@/components/shared/Button";

export function CTASection() {
  return (
    <section className="px-6 pb-24 pt-12">
      <ParallaxSection>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[#0F172A] px-8 py-16 text-center">
          <div className="pointer-events-none absolute -left-14 -top-16 h-48 w-48 rounded-full bg-[#2563EB]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-14 h-56 w-56 rounded-full bg-[#38BDF8]/20 blur-3xl" />
          <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white">
            Ready to launch your first AI phone agent?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[#CBD5E1]">
            Setup takes less than 5 minutes. No engineering team required.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button href="/signup">Start Free</Button>
            <Button href="/login" variant="secondary">
              Book Demo
            </Button>
          </div>
        </div>
      </ParallaxSection>
    </section>
  );
}
