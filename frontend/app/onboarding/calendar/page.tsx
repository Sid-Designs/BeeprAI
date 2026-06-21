"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { RouteGate } from "@/components/auth/RouteGate";
import { WorkingHoursEditor } from "@/components/calendar/WorkingHoursEditor";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { OnboardingSkipActions } from "@/components/onboarding/OnboardingSkipActions";
import { Button } from "@/components/shared/Button";
import { Input, Label } from "@/components/shared/FormField";
import { sortWorkingHoursByDay } from "@/lib/calendar";
import { getTenantId, updateOnboardingState } from "@/lib/auth";
import type { TenantCalendarSettings } from "@/lib/types";

export default function CalendarOnboardingPage() {
  const router = useRouter();
  const tenantId = getTenantId() || "";
  const [settings, setSettings] = useState<TenantCalendarSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    api
      .getCalendarSettings(tenantId)
      .then((response) => {
        setSettings({
          ...response.data,
          workingHours: sortWorkingHoursByDay(response.data.workingHours || []),
        });
      })
      .catch((err: Error) => setError(err.message));
  }, [tenantId]);

  const finishStep = () => {
    updateOnboardingState({ calendarCompleted: true });
    router.push("/onboarding/knowledge");
  };

  return (
    <RouteGate mode="onboarding">
      <OnboardingLayout
        activeStep={2}
        title="Set booking availability"
        subtitle="Tell your AI agent when it can offer appointment slots during calls."
        footer={
          <OnboardingSkipActions stepKey="calendarCompleted" nextRoute="/onboarding/knowledge" />
        }
      >
        {!tenantId ? (
          <p className="text-sm text-[#EF4444]">Workspace not found. Complete workspace setup first.</p>
        ) : !settings ? (
          <p className="text-sm text-[#64748B]">Loading calendar settings…</p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api.putCalendarSettings(tenantId, settings);
                finishStep();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={settings.timezone}
                onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
                placeholder="Asia/Kolkata"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="slotDuration">Slot duration (minutes)</Label>
                <Input
                  id="slotDuration"
                  type="number"
                  min={5}
                  value={settings.slotDurationMinutes}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      slotDurationMinutes: Number(event.target.value) || 30,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="buffer">Buffer between slots (minutes)</Label>
                <Input
                  id="buffer"
                  type="number"
                  min={0}
                  value={settings.bufferMinutes}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      bufferMinutes: Number(event.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Working days & hours</Label>
              <div className="mt-2">
                <WorkingHoursEditor
                  workingHours={settings.workingHours}
                  onChange={(workingHours) => setSettings({ ...settings, workingHours })}
                />
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save & continue"}
            </Button>
            {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
          </form>
        )}
      </OnboardingLayout>
    </RouteGate>
  );
}
