"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

export function FloatingElement({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(ref.current, {
          y: -12,
          repeat: -1,
          yoyo: true,
          duration: 2.4,
          ease: "sine.inOut",
        });
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return <div ref={ref} className={className}>{children}</div>;
}
