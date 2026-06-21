import { MagneticButton } from "@/components/animations/MagneticButton";
import { RevealSection } from "@/components/animations/RevealSection";
import { TextReveal } from "@/components/animations/TextReveal";
import { HeroWidget } from "@/components/marketing/HeroWidget";

const highlights = ["Human-like voice", "Trained on your business", "24/7 availability", "Setup in minutes"];

const teamAvatars = [
  { initials: "AR", from: "#2563EB", to: "#38BDF8" },
  { initials: "MK", from: "#6366F1", to: "#818CF8" },
  { initials: "SL", from: "#0EA5E9", to: "#22D3EE" },
  { initials: "JD", from: "#3B82F6", to: "#60A5FA" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade" />
      <div className="pointer-events-none absolute inset-0">
        <span className="aurora-blob animate-aurora left-[-6%] top-[6%] h-72 w-72 bg-[#BFDBFE]" />
        <span className="aurora-blob animate-aurora-slow right-[-4%] top-[2%] h-80 w-80 bg-[#C7D2FE]" />
        <span className="aurora-blob animate-aurora left-[36%] top-[44%] h-72 w-72 bg-[#BAE6FD]/70" />
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white/70 px-3.5 py-1.5 text-sm font-medium text-[#2563EB] shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2563EB]" />
            </span>
            AI Voice Automation Platform
          </div>

          <TextReveal
            text="AI Phone Agents That Sound Human"
            gradientFrom={3}
            className="mt-5 max-w-[14ch] text-[clamp(2.8rem,6vw,4.3rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-[#0F172A]"
          />

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#475569]">
            Handle sales, support, bookings, reminders and customer conversations with AI trained on your
            business knowledge.
          </p>

          <div className="mt-7 grid max-w-xl grid-cols-1 gap-2.5 sm:grid-cols-2">
            {highlights.map((item) => (
              <p
                key={item}
                className="group flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-white/70 px-3.5 py-2.5 text-sm font-medium text-[#334155] shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:shadow-md"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB] transition duration-300 group-hover:scale-110">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </p>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <MagneticButton href="/signup">Start Free</MagneticButton>
            <MagneticButton href="/login" variant="secondary">
              Watch Live Demo
            </MagneticButton>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm text-[#64748B]">
            <div className="flex -space-x-2">
              {teamAvatars.map((avatar) => (
                <span
                  key={avatar.initials}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white"
                  style={{ background: `linear-gradient(135deg, ${avatar.from}, ${avatar.to})` }}
                >
                  {avatar.initials}
                </span>
              ))}
            </div>
            <p>
              <span className="font-semibold text-[#0F172A]">500+ teams</span> automating calls today
            </p>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <RevealSection>
            <HeroWidget />
          </RevealSection>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F8FAFC]" />
    </section>
  );
}
