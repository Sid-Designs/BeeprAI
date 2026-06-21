"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

export function CounterAnimation({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const scope = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);

  useGSAP(
    () => {
      const node = scope.current;
      if (!node) return;

      const proxy = { v: 0 };
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => setCount(value));
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(proxy, {
          v: value,
          duration: 1.4,
          ease: "power2.out",
          onUpdate: () => setCount(Math.round(proxy.v)),
          scrollTrigger: {
            trigger: node,
            start: "top 85%",
            once: true,
          },
        });
      });
      return () => mm.revert();
    },
    { scope },
  );

  return (
    <span ref={scope}>
      {count}
      {suffix}
    </span>
  );
}
