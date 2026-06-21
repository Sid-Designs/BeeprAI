import { Card, CardHeader } from "@/components/ui/Card";
import type { ReactNode } from "react";

export function SectionShell({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card glass className={className}>
      <div className="p-6 sm:p-7">
        <CardHeader title={title} subtitle={subtitle} />
        {children}
      </div>
    </Card>
  );
}
