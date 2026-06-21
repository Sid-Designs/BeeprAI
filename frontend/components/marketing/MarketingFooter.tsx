"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/Button";

const footerLinks = {
  Product: [
    { label: "Product", href: "/#product" },
    { label: "Capabilities", href: "/#capabilities" },
    { label: "Use cases", href: "/#use-cases" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "Guided setup", href: "/onboarding/workspace" },
    { label: "Sign up", href: "/signup" },
    { label: "Dashboard", href: "/dashboard" },
    { label: "Admin", href: "/admin" },
  ],
  Resources: [
    { label: "Setup playbook", href: "/resources/setup-playbook" },
    { label: "Voice automation guide", href: "/resources/voice-automation-guide" },
    { label: "ROI calculator", href: "/resources/roi-calculator" },
    { label: "Integrations", href: "/#integrations" },
  ],
};

const socials = [
  {
    label: "X",
    href: "https://x.com/beepr_ai",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/beepr",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M4.98 3.5a2.5 2.5 0 11-.02 5.001A2.5 2.5 0 014.98 3.5zM3 9h4v12H3V9zm7 0h3.8v1.64h.05c.53-.95 1.83-1.95 3.76-1.95 4.02 0 4.76 2.65 4.76 6.1V21h-4v-5.36c0-1.28-.02-2.93-1.78-2.93-1.78 0-2.05 1.39-2.05 2.83V21h-4V9z" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/beepr-ai",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
        <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.36-3.37-1.36-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.34 9.34 0 0112 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.02 10.02 0 0022 12.25C22 6.58 17.52 2 12 2z" />
      </svg>
    ),
  },
];

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="mt-3 flex max-w-sm flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) setSubmitted(true);
      }}
    >
      {submitted ? (
        <p className="text-sm text-[#15803D]">Thanks — we&apos;ll keep you posted.</p>
      ) : (
        <>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-11 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 text-sm text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#BFDBFE] focus:ring-2 focus:ring-[#2563EB]/20"
          />
          <Button type="submit" size="md" className="shrink-0 shine">
            Subscribe
          </Button>
        </>
      )}
    </form>
  );
}

export function MarketingFooter() {
  return (
    <footer className="relative border-t border-[#E2E8F0] bg-gradient-to-b from-white to-[#F8FAFC]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#BFDBFE] to-transparent" />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="group flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] text-[#0F172A]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_8px_18px_rgba(37,99,235,0.3)]">
                <span className="h-2 w-2 rounded-full bg-white" />
              </span>
              Beepr
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#64748B]">
              Multi-tenant AI voice calling for admissions, sales, appointments, and customer support teams.
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-[#0F172A]">Stay in the loop</p>
              <NewsletterForm />
            </div>

            <div className="mt-6 flex items-center gap-2.5">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white text-[#475569] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#BFDBFE] hover:text-[#2563EB]"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <p className="text-sm font-semibold text-[#0F172A]">{group}</p>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-sm text-[#64748B] transition-colors hover:text-[#2563EB]"
                    >
                      <span className="h-1 w-0 rounded-full bg-[#2563EB] transition-all duration-300 group-hover:w-2.5" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[#E2E8F0] pt-8 sm:flex-row">
          <p className="text-xs text-[#94A3B8]">© {new Date().getFullYear()} Beepr. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#059669]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              </span>
              All systems operational
            </span>
            <Link href="/privacy" className="text-xs text-[#94A3B8] transition-colors hover:text-[#2563EB]">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-[#94A3B8] transition-colors hover:text-[#2563EB]">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
