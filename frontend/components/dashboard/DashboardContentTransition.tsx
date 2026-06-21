"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Animates only the dashboard main panel when routes change. */
export function DashboardContentTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="dash-enter min-w-0">
      {children}
    </div>
  );
}
