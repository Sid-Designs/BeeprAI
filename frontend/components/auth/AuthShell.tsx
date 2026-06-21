"use client";

import Link from "next/link";
import { useRef } from "react";

const avatars = [
  { initials: "AR", from: "#2563EB", to: "#38BDF8" },
  { initials: "MK", from: "#6366F1", to: "#818CF8" },
  { initials: "SL", from: "#0EA5E9", to: "#22D3EE" },
  { initials: "JD", from: "#3B82F6", to: "#60A5FA" },
];

export function AuthShell({
  title,
  subtitle,
  children,
  sideTitle,
  sidePoints,
  badge = "AI Voice Platform",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  sideTitle: string;
  sidePoints: string[];
  badge?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handlePointer(event: React.PointerEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8FAFC]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-70" />
        <div className="aurora-blob animate-aurora left-[-12%] top-[-15%] h-[460px] w-[460px] bg-[#BFDBFE]" />
        <div className="aurora-blob animate-aurora-slow right-[-14%] top-[18%] h-[420px] w-[420px] bg-[#C7D2FE]" />
        <div className="aurora-blob animate-aurora bottom-[-22%] left-[28%] h-[380px] w-[380px] bg-[#A5F3FC] opacity-40" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <Link
            href="/"
            className="auth-reveal group inline-flex items-center gap-2.5"
            style={{ animationDelay: "40ms" }}
          >
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)] transition-transform duration-300 group-hover:scale-105">
              <span className="text-base font-bold">B</span>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#38BDF8] ring-2 ring-[#F8FAFC]">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#38BDF8] opacity-75" />
              </span>
            </span>
            <span className="text-xl font-semibold tracking-[-0.02em] text-[#0F172A]">Beepr</span>
          </Link>

          <div
            className="auth-reveal mt-8 inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB] backdrop-blur"
            style={{ animationDelay: "110ms" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            {badge}
          </div>

          <h1
            className="auth-reveal mt-5 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-[#0F172A] sm:text-5xl"
            style={{ animationDelay: "180ms" }}
          >
            {sideTitle}
          </h1>

          <ul className="mt-8 space-y-3.5">
            {sidePoints.map((point, idx) => (
              <li
                key={point}
                className="auth-reveal flex items-start gap-3 text-sm text-[#475569]"
                style={{ animationDelay: `${250 + idx * 70}ms` }}
              >
                <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {point}
              </li>
            ))}
          </ul>

          <div
            className="auth-reveal mt-10 flex items-center gap-4"
            style={{ animationDelay: `${250 + sidePoints.length * 70 + 60}ms` }}
          >
            <div className="flex -space-x-2">
              {avatars.map((avatar) => (
                <span
                  key={avatar.initials}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-[#F8FAFC]"
                  style={{ background: `linear-gradient(135deg, ${avatar.from}, ${avatar.to})` }}
                >
                  {avatar.initials}
                </span>
              ))}
            </div>
            <p className="text-sm text-[#64748B]">
              <span className="font-semibold text-[#0F172A]">500+ teams</span> automate calls with Beepr
            </p>
          </div>
        </section>

        <div className="w-full">
          {/* Compact brand lockup for small screens where the side panel is hidden */}
          <Link href="/" className="auth-reveal mb-6 inline-flex items-center gap-2.5 lg:hidden">
            <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.35)]">
              <span className="text-base font-bold">B</span>
            </span>
            <span className="text-xl font-semibold tracking-[-0.02em] text-[#0F172A]">Beepr</span>
          </Link>

          <div
            ref={cardRef}
            onPointerMove={handlePointer}
            className="spotlight-card auth-reveal-card relative rounded-2xl border border-[#DBEAFE] bg-white/95 p-7 shadow-[0_30px_60px_rgba(37,99,235,0.12)] backdrop-blur-sm"
            style={{ animationDelay: "120ms" }}
          >
            <h2 className="text-2xl font-semibold tracking-[-0.01em] text-[#0F172A]">{title}</h2>
            <p className="mt-2 text-sm text-[#64748B]">{subtitle}</p>
            <div className="mt-6">{children}</div>
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#EEF2F7] pt-5 text-xs text-[#94A3B8]">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#22C55E]">
                <path
                  fillRule="evenodd"
                  d="M10 1.5l6 2.4v4.3c0 4-2.6 7.6-6 8.8-3.4-1.2-6-4.8-6-8.8V3.9l6-2.4zm2.7 6.2a1 1 0 00-1.4-1.4L9 8.6 8.2 7.8a1 1 0 10-1.4 1.4l1.5 1.5a1 1 0 001.4 0l3-3z"
                  clipRule="evenodd"
                />
              </svg>
              Secured with enterprise-grade encryption
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
