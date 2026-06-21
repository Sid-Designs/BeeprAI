import Link from "next/link";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "bg-gradient-to-br from-[#0ea5e9] via-[#0284c7] to-[#0369a1] text-white shadow-[0_4px_20px_rgba(14,165,233,0.35)] hover:shadow-[0_8px_28px_rgba(14,165,233,0.42)] hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "bg-white text-[#0c1a2e] border border-[#d4e3f7] shadow-sm hover:border-[#93c5fd] hover:bg-[#f0f7ff] hover:-translate-y-0.5 active:translate-y-0",
  ghost: "bg-transparent text-[#5b7190] hover:text-[#0c1a2e] hover:bg-[#0ea5e9]/8",
  outline:
    "bg-transparent text-[#0369a1] border border-[#0ea5e9]/40 hover:bg-[#0ea5e9]/6 hover:border-[#0ea5e9]",
  white:
    "bg-white text-[#0369a1] shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
} as const;

const sizes = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
} as const;

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = BaseProps & { href: string; onClick?: () => void };

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", size = "md", className, children } = props;

  const classes = cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9]/50 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
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

  const buttonProps = props as ButtonAsButton;
  return (
    <button type={(buttonProps as ButtonAsButton).type ?? "button"} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
