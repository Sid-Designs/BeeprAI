"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/bulk-calls", label: "Bulk calling" },
  { href: "/dashboard/calendar", label: "Bookings" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-sm">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Navigation</p>
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "block rounded-xl px-3 py-2 text-sm font-medium transition",
              pathname === link.href ? "bg-[#2563EB] text-white" : "text-[#334155] hover:bg-[#F1F5F9]",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
