import { cn } from "@/lib/cn";

export function SectionFrame({
  id,
  badge,
  title,
  subtitle,
  align = "left",
  className,
  children,
}: {
  id?: string;
  badge?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl scroll-mt-24 px-6 py-20 lg:py-24", className)}>
      <div className={cn("mb-12", align === "center" && "mx-auto max-w-3xl text-center")}>
        {badge ? (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB]",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
            {badge}
          </span>
        ) : null}
        <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[#0F172A]">
          {title}
        </h2>
        <div className={cn("accent-line mt-5", align === "center" && "mx-auto")} />
        {subtitle ? <p className="mt-5 text-lg leading-relaxed text-[#64748B]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
