"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useScrolled } from "@/hooks/useScrolled";
import { Button } from "@/components/shared/Button";
import {
  getAuthSessionSnapshot,
  getServerAuthSessionSnapshot,
  subscribeAuthSession,
} from "@/lib/auth";
import { cn } from "@/lib/cn";

const navLinks = [
  { href: "/#product", label: "Product" },
  { href: "/#use-cases", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#resources", label: "Resources" },
];

export function MarketingNavbar() {
  const scrolled = useScrolled(18);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const session = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSessionSnapshot,
  );
  const loggedIn = Boolean(session);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const last = lastYRef.current;
      if (!menuOpen) {
        if (y > 140 && y > last) {
          setHidden(true);
        } else if (y < last) {
          setHidden(false);
        }
      }
      lastYRef.current = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    lastYRef.current = window.scrollY;
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-transform duration-500 ease-out",
          hidden ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <div
          className={cn(
            "mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-300 sm:px-5",
            scrolled
              ? "h-[60px] border border-[#E2E8F0] bg-white/80 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
              : "h-[68px] border border-transparent bg-white/0 shadow-none backdrop-blur-0",
          )}
        >
          <Link
            href="/"
            className="group flex items-center gap-2 text-xl font-semibold tracking-[-0.03em] text-[#0F172A]"
          >
            <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition duration-300 group-hover:scale-105">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-white/70" />
              <span className="relative h-2 w-2 rounded-full bg-white" />
            </span>
            Beepr
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group relative rounded-lg px-3 py-2 text-sm font-medium text-[#475569] transition hover:text-[#0F172A]"
              >
                <span className="absolute inset-0 scale-90 rounded-lg bg-[#F1F5F9] opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100" />
                <span className="relative">{link.label}</span>
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex">
            {loggedIn ? (
              <Button href="/dashboard" size="sm" className="shine">
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button href="/login" variant="ghost" size="sm">
                  Login
                </Button>
                <Button href="/signup" size="sm" className="shine">
                  Start Free
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg border border-[#E2E8F0] bg-white/70 lg:hidden"
          >
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-[#334155] transition-all duration-300",
                menuOpen && "translate-y-[7px] rotate-45",
              )}
            />
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-[#334155] transition-all duration-300",
                menuOpen && "opacity-0",
              )}
            />
            <span
              className={cn(
                "h-0.5 w-4 rounded-full bg-[#334155] transition-all duration-300",
                menuOpen && "-translate-y-[7px] -rotate-45",
              )}
            />
          </button>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/20 transition lg:hidden",
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMenuOpen(false)}
      >
        <div
          className={cn(
            "absolute right-4 top-20 w-[min(88vw,320px)] rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xl transition duration-300",
            menuOpen ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-[#334155] hover:bg-[#F8FAFC]"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            {loggedIn ? (
              <Button href="/dashboard" onClick={() => setMenuOpen(false)}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button href="/login" variant="secondary" onClick={() => setMenuOpen(false)}>
                  Login
                </Button>
                <Button href="/signup" onClick={() => setMenuOpen(false)}>
                  Start Free
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
