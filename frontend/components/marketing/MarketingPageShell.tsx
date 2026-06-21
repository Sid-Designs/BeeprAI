import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingNavbar } from "@/components/marketing/MarketingNavbar";

export function MarketingPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-h-screen bg-white text-[#0F172A] ${className ?? ""}`}>
      <MarketingNavbar />
      <main className="pt-[74px]">{children}</main>
      <MarketingFooter />
    </div>
  );
}
