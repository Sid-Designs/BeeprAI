import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { KnowledgePanel } from "@/components/dashboard/KnowledgePanel";

export default function DashboardKnowledgePage() {
  return (
    <DashboardLayout
      heading="Knowledge"
      description="Upload documents and context to ground your agents."
    >
      <KnowledgePanel />
    </DashboardLayout>
  );
}
