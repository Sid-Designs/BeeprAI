"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-[#2563EB] text-white hover:bg-[#1D4ED8] shadow-[0_12px_24px_rgba(37,99,235,0.22)]",
  secondary: "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F1F5F9]",
  ghost: "bg-transparent text-[#334155] hover:bg-[#F1F5F9]",
  danger: "bg-[#EF4444] text-white hover:bg-[#DC2626]",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

type SharedProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps =
  | (SharedProps & React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (SharedProps & { href: string; onClick?: () => void });

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children, ...rest } = props;

  const classes = cn(
    "inline-flex items-center justify-center rounded-xl font-semibold transition duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} onClick={props.onClick}>
        {children}
      </Link>
    );
  }

  // `rest` no longer contains variant/size/className/children, so it is safe to
  // spread onto the DOM element. className/type are applied after the spread so
  // they cannot be overridden by forwarded props.
  const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button {...buttonProps} type={buttonProps.type ?? "button"} className={classes}>
      {children}
    </button>
  );
}
