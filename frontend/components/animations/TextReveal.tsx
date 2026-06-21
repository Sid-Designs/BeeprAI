"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, SplitText, setupGsap } from "@/lib/gsap";

setupGsap();

export function TextReveal({
  text,
  className,
  gradientFrom,
}: {
  text: string;
  className?: string;
  gradientFrom?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const applyGradient = (words: Element[]) => {
        if (typeof gradientFrom !== "number") return;
        words.forEach((word, index) => {
          if (index >= gradientFrom) word.classList.add("text-gradient");
        });
      };

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        const split = SplitText.create(el, { type: "words" });
        applyGradient(split.words);
        gsap.set(el, { opacity: 1, y: 0 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = SplitText.create(el, { type: "words" });
        applyGradient(split.words);
        gsap.from(split.words, {
          opacity: 0,
          y: 24,
          rotateX: -40,
          transformOrigin: "0% 50% -20px",
          stagger: 0.055,
          duration: 0.8,
          ease: "power3.out",
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <h1 ref={ref} className={className}>
      {text}
    </h1>
  );
}
