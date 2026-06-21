import { CalendarPanel } from "@/components/dashboard/CalendarPanel";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function DashboardCalendarPage() {
  return (
    <DashboardLayout
      heading="Bookings"
      description="View AI-booked appointments, manage availability, and schedule slots manually."
    >
      <CalendarPanel />
    </DashboardLayout>
  );
}
