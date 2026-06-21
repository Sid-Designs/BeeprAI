"use client";

import { useRef, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/cn";

setupGsap();

export function SpotlightCard({
  children,
  className,
  tilt = true,
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (pointer: fine)", () => {
        const setRotX = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
        const setRotY = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });

        const move = (event: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width;
          const py = (event.clientY - rect.top) / rect.height;
          el.style.setProperty("--mx", `${px * 100}%`);
          el.style.setProperty("--my", `${py * 100}%`);
          if (tilt) {
            setRotY((px - 0.5) * 7);
            setRotX(-(py - 0.5) * 7);
          }
        };

        const leave = () => {
          if (tilt) {
            setRotX(0);
            setRotY(0);
          }
        };

        gsap.set(el, { transformPerspective: 900, transformStyle: "preserve-3d" });
        el.addEventListener("mousemove", move);
        el.addEventListener("mouseleave", leave);
        return () => {
          el.removeEventListener("mousemove", move);
          el.removeEventListener("mouseleave", leave);
        };
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Card
      ref={ref}
      hover
      className={cn("spotlight-card", className)}
    >
      {children}
    </Card>
  );
}
