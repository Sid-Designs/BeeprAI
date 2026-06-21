import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  error: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  success: "border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]",
  info: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
};

export function InlineAlert({
  variant = "info",
  children,
  className,
}: {
  variant?: keyof typeof variants;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
