"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger, setupGsap } from "@/lib/gsap";

setupGsap();

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const trigger = ScrollTrigger.create({
        start: 0,
        end: () => document.documentElement.scrollHeight - window.innerHeight,
        onUpdate: (self) => {
          gsap.set(el, { scaleX: self.progress });
        },
      });

      // Recompute all ScrollTrigger start/end positions once async layout
      // (fonts, images, late-mounting sections) settles, so reveal animations
      // don't get stuck hidden because of stale measurements.
      const refresh = () => ScrollTrigger.refresh();
      const t1 = window.setTimeout(refresh, 300);
      const t2 = window.setTimeout(refresh, 1200);
      window.addEventListener("load", refresh);
      if (typeof document !== "undefined" && document.fonts?.ready) {
        document.fonts.ready.then(refresh).catch(() => {});
      }

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.removeEventListener("load", refresh);
        trigger.kill();
      };
    },
    { scope: ref },
  );

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div ref={ref} className="scroll-progress h-full w-full" />
    </div>
  );
}
