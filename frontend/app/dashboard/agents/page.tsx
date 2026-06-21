import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AgentsPanel } from "@/components/dashboard/AgentsPanel";

export default function DashboardAgentsPage() {
  return (
    <DashboardLayout
      heading="Agents"
      description="Create and manage AI voice agents for your business workflows."
    >
      <AgentsPanel />
    </DashboardLayout>
  );
}
