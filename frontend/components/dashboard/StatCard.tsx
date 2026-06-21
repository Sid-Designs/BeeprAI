import type { ReactNode } from "react";
import { Card } from "@/components/shared/Card";

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <Card hover className="group">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-[0.12em] text-[#94A3B8]">{title}</p>
        {icon ? (
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB] transition duration-300 group-hover:bg-gradient-to-br group-hover:from-[#2563EB] group-hover:to-[#38BDF8] group-hover:text-white">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[#0F172A]">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {trend ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              trend.positive === false ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#F0FDF4] text-[#16A34A]"
            }`}
          >
            {trend.positive === false ? "↓" : "↑"} {trend.value}
          </span>
        ) : null}
        {subtitle ? <p className="text-sm text-[#64748B]">{subtitle}</p> : null}
      </div>
    </Card>
  );
}
