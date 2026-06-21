"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

let registered = false;

export function setupGsap() {
  if (registered) return;
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
  gsap.defaults({ duration: 0.7, ease: "power2.out" });
  registered = true;
}

export { gsap, ScrollTrigger, SplitText };
