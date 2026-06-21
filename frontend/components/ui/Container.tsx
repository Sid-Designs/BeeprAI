import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
  narrow = false,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        narrow ? "max-w-3xl" : "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  variant = "default",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "white" | "mesh";
}) {
  const bg =
    variant === "white"
      ? "bg-white"
      : variant === "mesh"
        ? "mesh-bg bg-[#f4f8ff]"
        : "bg-[#f4f8ff]";

  return (
    <section id={id} className={cn("py-20 sm:py-24 lg:py-28", bg, className)}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeader({
  badge,
  title,
  description,
  align = "center",
  className,
}: {
  badge?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-12 sm:mb-14 lg:mb-16",
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl",
        className,
      )}
    >
      {badge ? (
        <div className={cn("mb-4", align === "center" && "flex justify-center")}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0ea5e9]/25 bg-gradient-to-r from-[#0ea5e9]/10 to-[#6366f1]/8 px-3.5 py-1 text-xs font-semibold tracking-wide text-[#0369a1] uppercase">
            {badge}
          </span>
        </div>
      ) : null}
      <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[#0c1a2e] sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-[#5b7190] sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
