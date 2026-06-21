import { cn } from "@/lib/cn";

export function Badge({
  children,
  className,
  dot = false,
}: {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#0ea5e9]/25 bg-gradient-to-r from-[#0ea5e9]/10 to-[#6366f1]/8",
        "px-3.5 py-1 text-xs font-semibold tracking-wide text-[#0369a1] uppercase",
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-[#0ea5e9]" aria-hidden /> : null}
      {children}
    </span>
  );
}
