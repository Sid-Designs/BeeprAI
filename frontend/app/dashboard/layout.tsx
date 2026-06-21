import { DashboardShell } from "@/components/dashboard/DashboardLayout";
import { SessionBootstrap } from "@/lib/sessionBootstrap";
import { RouteGate } from "@/components/auth/RouteGate";

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGate mode="dashboard">
      <SessionBootstrap />
      <DashboardShell>{children}</DashboardShell>
    </RouteGate>
  );
}