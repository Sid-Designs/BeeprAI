"use client";

import { usePathname } from "next/navigation";

export default function OnboardingTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="onboarding-enter">
      {children}
    </div>
  );
}
