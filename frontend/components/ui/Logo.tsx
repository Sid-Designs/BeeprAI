import Link from "next/link";
import { cn } from "@/lib/cn";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] text-sm font-bold text-white shadow-md shadow-sky-500/25 transition-transform duration-200 group-hover:scale-105">
        B
      </span>
      <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight text-[#0c1a2e]">
        Beepr
      </span>
    </Link>
  );
}
