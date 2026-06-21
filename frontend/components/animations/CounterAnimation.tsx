"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, setupGsap } from "@/lib/gsap";

setupGsap();

export function CounterAnimation({
  value,
  suffix = "",
  animateOnScroll = false,
}: {
  value: number;
  suffix?: string;
  /** Marketing sections: animate when scrolled into view. Dashboard stats: leave false. */
  animateOnScroll?: boolean;
}) {
  const scope = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(value);
  const fromRef = useRef(value);

  useGSAP(
    () => {
      const node = scope.current;
      if (!node) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        fromRef.current = value;
        setCount(value);
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const proxy = { v: fromRef.current };
        const tween = {
          v: value,
          duration: 1.4,
          ease: "power2.out",
          onUpdate: () => {
            const next = Math.round(proxy.v);
            fromRef.current = next;
            setCount(next);
          },
          onComplete: () => {
            fromRef.current = value;
            setCount(value);
          },
        };

        if (animateOnScroll) {
          gsap.to(proxy, {
            ...tween,
            scrollTrigger: {
              trigger: node,
              start: "top 85%",
              once: true,
            },
          });
        } else {
          gsap.to(proxy, tween);
        }
      });

      return () => mm.revert();
    },
    { scope, dependencies: [value, animateOnScroll] },
  );

  return (
    <span ref={scope}>
      {count}
      {suffix}
    </span>
  );
}
