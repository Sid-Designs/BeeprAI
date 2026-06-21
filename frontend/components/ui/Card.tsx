import { cn } from "@/lib/cn";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  hover?: boolean;
  glass?: boolean;
};

export function Card({ children, className, hover = false, glass = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#d4e3f7] bg-white",
        glass && "bg-white/90 backdrop-blur-xl",
        "shadow-[0_2px_16px_rgba(12,26,46,0.04)]",
        hover &&
          "transition-all duration-300 hover:-translate-y-1 hover:border-[#93c5fd] hover:shadow-[0_12px_40px_rgba(14,165,233,0.1)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#0c1a2e]">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm leading-relaxed text-[#5b7190]">{subtitle}</p> : null}
    </div>
  );
}
