"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";
import { getRouteZone, type RouteZone } from "@/lib/routes";

setupGsap();

type TransitionPreset = {
  from: { opacity: number; y?: number; scale?: number };
  duration: number;
};

function getPreset(zone: RouteZone, sameZone: boolean): TransitionPreset | null {
  if (zone === "dashboard") return null;

  if (sameZone) {
    return { from: { opacity: 0, y: 6 }, duration: 0.28 };
  }

  switch (zone) {
    case "marketing":
      return { from: { opacity: 0, y: 14, scale: 0.985 }, duration: 0.55 };
    case "auth":
      return { from: { opacity: 0, y: 10 }, duration: 0.38 };
    case "onboarding":
      return { from: { opacity: 0, y: 12 }, duration: 0.42 };
    case "app":
      return { from: { opacity: 0, y: 8 }, duration: 0.35 };
    default:
      return { from: { opacity: 0, y: 10 }, duration: 0.38 };
  }
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const prevPathRef = useRef(pathname);

  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el) return;

      const zone = getRouteZone(pathname);
      const prevZone = getRouteZone(prevPathRef.current);
      const sameZone = zone === prevZone && prevPathRef.current !== pathname;
      const preset = getPreset(zone, sameZone);

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { opacity: 1, clearProps: "transform" });
        prevPathRef.current = pathname;
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!preset) {
          gsap.set(el, { opacity: 1, clearProps: "transform" });
          prevPathRef.current = pathname;
          return;
        }

        gsap.fromTo(
          el,
          {
            opacity: preset.from.opacity,
            y: preset.from.y ?? 0,
            scale: preset.from.scale ?? 1,
          },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: preset.duration,
            ease: "power2.out",
            onComplete: () => {
              gsap.set(el, { clearProps: "transform" });
              prevPathRef.current = pathname;
            },
          },
        );
      });

      return () => mm.revert();
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return <div ref={rootRef}>{children}</div>;
}
