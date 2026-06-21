import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AnalyticsPanel } from "@/components/dashboard/AnalyticsPanel";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";

export default function DashboardAnalyticsPage() {
  return (
    <DashboardLayout
      heading="Analytics"
      description="Track call performance, conversion trends, and agent effectiveness for your workspace."
    >
      <WorkspaceGate>
        <AnalyticsPanel />
      </WorkspaceGate>
    </DashboardLayout>
  );
}
