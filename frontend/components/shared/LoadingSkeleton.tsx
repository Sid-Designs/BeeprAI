import { cn } from "@/lib/cn";

export function LoadingSkeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("animate-pulse rounded-xl bg-[#E2E8F0]", className)} />;
}
