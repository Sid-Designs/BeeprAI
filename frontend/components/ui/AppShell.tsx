"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
};

export function AppShell({
  title,
  nav,
  actions,
  children,
}: {
  title: string;
  nav: NavItem[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7fbff]">
      <header className="sticky top-0 z-20 border-b border-[#d7e5f8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg font-semibold text-[#10233c]">
            Beepr
          </Link>
          <nav className="flex items-center gap-1 rounded-full border border-[#d7e5f8] bg-[#f7fbff] p-1">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    active ? "bg-[#0ea5e9] text-white" : "text-[#325178] hover:bg-[#e8f3ff]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div>{actions}</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-[#10233c]">{title}</h1>
        {children}
      </main>
    </div>
  );
}
