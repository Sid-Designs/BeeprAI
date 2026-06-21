import { PlatformAdminGate } from "@/components/admin/PlatformAdminGate";
import { AdminPlatformPanel } from "@/components/admin/AdminPlatformPanel";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function DashboardAdminPage() {
  return (
    <PlatformAdminGate>
      <DashboardLayout
        heading="Platform admin"
        description="Cross-tenant visibility for owners — tenants, agents, and call analytics."
      >
        <AdminPlatformPanel />
      </DashboardLayout>
    </PlatformAdminGate>
  );
}
