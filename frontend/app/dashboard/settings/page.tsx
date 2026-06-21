import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";

export default function DashboardSettingsPage() {
  return (
    <DashboardLayout
      heading="Settings"
      description="Manage your profile, workspace, and account preferences."
    >
      <SettingsPanel />
    </DashboardLayout>
  );
}
