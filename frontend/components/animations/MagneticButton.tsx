"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";
import { Button } from "@/components/shared/Button";

setupGsap();

export function MagneticButton({
  href,
  children,
  variant,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const move = (event: MouseEvent) => {
          const rect = wrap.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          gsap.to(wrap, { x: x * 0.16, y: y * 0.16, duration: 0.3 });
        };
        const leave = () => {
          gsap.to(wrap, { x: 0, y: 0, duration: 0.45, ease: "power3.out" });
        };

        wrap.addEventListener("mousemove", move);
        wrap.addEventListener("mouseleave", leave);
        return () => {
          wrap.removeEventListener("mousemove", move);
          wrap.removeEventListener("mouseleave", leave);
        };
      });
      return () => mm.revert();
    },
    { scope: wrapRef },
  );

  return (
    <div ref={wrapRef} className="inline-flex">
      <Button href={href} variant={variant}>
        {children}
      </Button>
    </div>
  );
}
