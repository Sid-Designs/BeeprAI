"use client";

import { Input } from "@/components/shared/FormField";
import { sortWorkingHoursByDay, WEEKDAY_LABELS } from "@/lib/calendar";
import type { WorkingHoursEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

export function WorkingHoursEditor({
  workingHours,
  onChange,
}: {
  workingHours: WorkingHoursEntry[];
  onChange: (next: WorkingHoursEntry[]) => void;
}) {
  const ordered = sortWorkingHoursByDay(workingHours);

  const updateEntry = (day: number, patch: Partial<WorkingHoursEntry>) => {
    onChange(ordered.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  };

  return (
    <div className="space-y-2">
      {ordered.map((entry) => {
        const enabled = entry.enabled !== false;
        return (
          <div
            key={entry.day}
            className={cn(
              "grid gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-[120px_1fr_1fr]",
              !enabled && "opacity-70",
            )}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-[#334155]">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => updateEntry(entry.day, { enabled: event.target.checked })}
                className="h-4 w-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]/30"
              />
              {WEEKDAY_LABELS[entry.day] ?? entry.day}
            </label>
            <Input
              value={entry.start}
              disabled={!enabled}
              onChange={(event) => updateEntry(entry.day, { start: event.target.value })}
              placeholder="09:00"
            />
            <Input
              value={entry.end}
              disabled={!enabled}
              onChange={(event) => updateEntry(entry.day, { end: event.target.value })}
              placeholder="18:00"
            />
          </div>
        );
      })}
      <p className="text-xs text-[#94A3B8]">
        Enable Saturday or Sunday for weekend bookings. Disabled days will not offer slots.
      </p>
    </div>
  );
}
