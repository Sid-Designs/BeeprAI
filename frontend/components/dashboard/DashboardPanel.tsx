import type { ReactNode } from "react";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/cn";

export function DashboardPanel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] pb-5">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#0F172A]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#64748B]">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className={cn("pt-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
