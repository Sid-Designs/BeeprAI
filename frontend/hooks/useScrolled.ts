"use client";

import { useEffect, useState } from "react";

/** RAF-throttled scroll listener — avoids navbar jank from rapid setState. */
export function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    let mounted = true;

    const update = () => {
      if (!mounted) return;
      setScrolled(window.scrollY > threshold);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mounted = false;
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold]);

  return scrolled;
}
