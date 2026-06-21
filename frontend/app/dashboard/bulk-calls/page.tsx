import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { BulkCallsPanel } from "@/components/dashboard/BulkCallsPanel";

export default function DashboardBulkCallsPage() {
  return (
    <DashboardLayout
      heading="Bulk calling"
      description="Upload contact lists and run automated back-to-back outbound campaigns."
    >
      <BulkCallsPanel />
    </DashboardLayout>
  );
}
