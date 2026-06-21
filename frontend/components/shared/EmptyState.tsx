import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { cn } from "@/lib/cn";

const icons = {
  default: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v6h6" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a6 6 0 016-6h6a6 6 0 016 6v1" />
    </svg>
  ),
  calls: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.6a1 1 0 01.95.68l1.2 3.6a1 1 0 01-.5 1.2L7.5 9.6a12 12 0 006.9 6.9l1.12-1.75a1 1 0 011.2-.5l3.6 1.2a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.6 21 3 14.4 3 6V5z" />
    </svg>
  ),
};

export function EmptyState({
  title,
  description,
  cta,
  icon = "default",
  className,
}: {
  title: string;
  description: string;
  cta?: { label: string; href: string };
  icon?: keyof typeof icons;
  className?: string;
}) {
  return (
    <Card className={cn("text-center", className)}>
      <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EFF6FF] to-[#DBEAFE] text-[#2563EB]">
        {icons[icon]}
      </div>
      <h3 className="text-lg font-semibold text-[#0F172A]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">{description}</p>
      {cta ? (
        <div className="mt-5">
          <Button href={cta.href} className="shine">{cta.label}</Button>
        </div>
      ) : null}
    </Card>
  );
}
