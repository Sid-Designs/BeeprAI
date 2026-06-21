import Link from "next/link";
import { Card } from "@/components/shared/Card";
import { OnboardingWelcomeLink } from "@/components/onboarding/OnboardingSkipActions";

const steps = [
  { key: "workspace", label: "Workspace", desc: "Create your space", route: "/onboarding/workspace" },
  { key: "agent", label: "Agent", desc: "Configure AI voice", route: "/onboarding/agent" },
  { key: "calendar", label: "Bookings", desc: "Set availability", route: "/onboarding/calendar" },
  { key: "knowledge", label: "Knowledge", desc: "Upload context", route: "/onboarding/knowledge" },
  { key: "test", label: "Test", desc: "Preview answers", route: "/onboarding/test" },
  { key: "first-call", label: "First call", desc: "Go live", route: "/onboarding/first-call" },
];

export function OnboardingLayout({
  title,
  subtitle,
  activeStep,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  activeStep: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const progress = Math.round(((activeStep + 1) / steps.length) * 100);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        <div className="aurora-blob animate-aurora left-[-10%] top-[-18%] h-[420px] w-[420px] bg-[#BFDBFE] opacity-40" />
        <div className="aurora-blob animate-aurora-slow right-[-12%] top-[8%] h-[360px] w-[360px] bg-[#C7D2FE] opacity-40" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] transition-transform duration-300 group-hover:scale-105">
              <span className="text-base font-bold">B</span>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#38BDF8] ring-2 ring-[#F8FAFC]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#38BDF8] opacity-75" />
              </span>
            </span>
            <span className="text-xl font-semibold tracking-[-0.02em] text-[#0F172A]">Beepr</span>
          </Link>
          <span className="rounded-full border border-[#DBEAFE] bg-white/70 px-3 py-1 text-xs font-semibold text-[#2563EB] backdrop-blur">
            Step {activeStep + 1} of {steps.length}
          </span>
        </div>

        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2563EB] via-[#38BDF8] to-[#6366F1] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Your setup journey</p>
            <ol className="mt-5">
              {steps.map((step, idx) => {
                const done = idx < activeStep;
                const active = idx === activeStep;
                const isLast = idx === steps.length - 1;
                return (
                  <li key={step.key} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {!isLast ? (
                      <span
                        aria-hidden
                        className={`absolute left-[15px] top-9 h-[calc(100%-1.75rem)] w-px ${
                          done ? "bg-[#93C5FD]" : "bg-[#E2E8F0]"
                        }`}
                      />
                    ) : null}
                    <span
                      className={`relative z-10 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold transition ${
                        done
                          ? "bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_6px_14px_rgba(37,99,235,0.3)]"
                          : active
                            ? "bg-white text-[#2563EB] ring-2 ring-[#2563EB]"
                            : "bg-[#F1F5F9] text-[#94A3B8]"
                      }`}
                    >
                      {done ? (
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path
                            fillRule="evenodd"
                            d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <div className="pt-0.5">
                      <p className={`text-sm font-semibold ${active || done ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[#94A3B8]">{step.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <div>
            <Card className="p-6 sm:p-8">
              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#0F172A]">{title}</h1>
              <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p>
              <div className="mt-6">{children}</div>
              {footer}
            </Card>
            <OnboardingWelcomeLink />
          </div>
        </div>
      </div>
    </div>
  );
}
