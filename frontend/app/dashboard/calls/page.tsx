import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CallsPanel } from "@/components/dashboard/CallsPanel";

export default function DashboardCallsPage() {
  return (
    <DashboardLayout
      heading="Calls"
      description="Start outbound calls and review conversation history."
    >
      <CallsPanel />
    </DashboardLayout>
  );
}
