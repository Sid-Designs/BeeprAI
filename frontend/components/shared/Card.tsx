import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type CardProps = {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
};

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { className, children, hover = false },
  ref,
) {
  return (
    <section
      ref={ref}
      className={cn(
        "rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_25px_rgba(15,23,42,0.04)]",
        hover &&
          "transition duration-300 hover:-translate-y-1 hover:border-[#BFDBFE] hover:shadow-[0_22px_38px_rgba(37,99,235,0.12)]",
        className,
      )}
    >
      {children}
    </section>
  );
});
