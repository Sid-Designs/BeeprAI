import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { OverviewPanel } from "@/components/dashboard/OverviewPanel";

export default function DashboardIndexPage() {
  return (
    <DashboardLayout
      heading="Overview"
      description="Your workspace summary, quick actions, and setup progress."
    >
      <OverviewPanel />
    </DashboardLayout>
  );
}
