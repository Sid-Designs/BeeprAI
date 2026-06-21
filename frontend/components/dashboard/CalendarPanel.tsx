"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import {
  addDays,
  endOfWeek,
  formatAppointmentDateTime,
  formatSlotRange,
  formatWeekLabel,
  groupAppointmentsByDay,
  initialsFromName,
  isSameWeek,
  slotKey,
  sortWorkingHoursByDay,
  startOfWeek,
  statusMeta,
  toDateInputValue,
  WEEKDAY_LABELS,
} from "@/lib/calendar";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { WorkspaceGate } from "@/components/dashboard/WorkspaceGate";
import { Button } from "@/components/shared/Button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Input, Label } from "@/components/shared/FormField";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { Modal } from "@/components/shared/Modal";
import type { Appointment, CalendarSlot, TenantCalendarSettings, WorkingHoursEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

function SourceBadge({ createdBy }: { createdBy?: string }) {
  const isAi = createdBy === "ai_agent";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        isAi ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#F0FDF4] text-[#15803D]",
      )}
    >
      {isAi ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M10 2a1 1 0 01.89.55l1.82 3.68 4.07.59a1 1 0 01.55 1.7l-2.95 2.87.7 4.05a1 1 0 01-1.45 1.05L10 14.9l-3.63 1.9a1 1 0 01-1.45-1.05l.7-4.05L2.67 8.52a1 1 0 01.55-1.7l4.07-.59L8.11 2.55A1 1 0 0110 2z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {isAi ? "AI agent" : "Manual"}
    </span>
  );
}

function AppointmentCard({
  appointment,
  selected,
  onSelect,
}: {
  appointment: Appointment;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = statusMeta(appointment.status);
  const displayName = appointment.customerName || appointment.customerPhone || "Customer";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition duration-200",
        selected
          ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_8px_24px_rgba(37,99,235,0.12)] ring-1 ring-[#2563EB]/20"
          : "border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:bg-[#F8FBFF]",
      )}
    >
      <span
        className={cn(
          "inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl text-sm font-semibold",
          selected ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#475569] group-hover:bg-[#DBEAFE] group-hover:text-[#1D4ED8]",
        )}
      >
        {initialsFromName(displayName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-[#0F172A]">{displayName}</span>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", meta.badge)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </span>
        <span className="mt-1 block text-sm text-[#64748B]">
          {formatSlotRange(appointment.startAt, appointment.endAt)}
        </span>
        <span className="mt-2 inline-flex">
          <SourceBadge createdBy={appointment.createdBy} />
        </span>
      </span>
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className={cn(
          "mt-1 h-5 w-5 flex-none transition",
          selected ? "text-[#2563EB]" : "text-[#CBD5E1] group-hover:text-[#94A3B8]",
        )}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M7.3 5.3a1 1 0 011.4 0l4 4a1 1 0 010 1.4l-4 4a1 1 0 01-1.4-1.4L10.6 10 7.3 6.7a1 1 0 010-1.4z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">{label}</p>
      <div className="mt-1 text-sm font-medium text-[#0F172A]">{children}</div>
    </div>
  );
}

function AppointmentDetail({
  appointment,
  busy,
  onCancel,
  onClose,
  showClose = false,
}: {
  appointment: Appointment;
  busy: boolean;
  onCancel: () => void;
  onClose?: () => void;
  showClose?: boolean;
}) {
  const meta = statusMeta(appointment.status);
  const displayName = appointment.customerName || "Unknown customer";

  return (
    <div className="flex h-full flex-col">
      <div className="rounded-xl bg-gradient-to-br from-[#2563EB] to-[#38BDF8] p-5 text-white shadow-[0_12px_30px_rgba(37,99,235,0.2)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-base font-semibold backdrop-blur">
              {initialsFromName(displayName)}
            </span>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="mt-0.5 text-sm text-white/85">{formatAppointmentDateTime(appointment.startAt)}</p>
            </div>
          </div>
          {showClose && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-white/90 hover:bg-white/15"
            >
              Close
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur">
            {meta.label}
          </span>
          <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur">
            {appointment.createdBy === "ai_agent" ? "Booked by AI" : "Booked manually"}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <DetailRow label="Time slot">{formatSlotRange(appointment.startAt, appointment.endAt)}</DetailRow>
        <DetailRow label="Phone">
          {appointment.customerPhone ? (
            <a href={`tel:${appointment.customerPhone}`} className="text-[#2563EB] hover:underline">
              {appointment.customerPhone}
            </a>
          ) : (
            "—"
          )}
        </DetailRow>
        {appointment.notes ? <DetailRow label="Notes">{appointment.notes}</DetailRow> : null}
        {appointment.sessionId ? (
          <DetailRow label="Linked call">
            <Link href="/dashboard/calls" className="text-[#2563EB] hover:underline">
              View in call history
            </Link>
            <p className="mt-1 break-all font-mono text-xs font-normal text-[#64748B]">
              {appointment.sessionId}
            </p>
          </DetailRow>
        ) : null}
      </div>

      {appointment.status !== "cancelled" ? (
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          <Button variant="danger" size="sm" onClick={onCancel} disabled={busy}>
            {busy ? "Cancelling…" : "Cancel booking"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WorkingHoursEditor({
  workingHours,
  onChange,
}: {
  workingHours: WorkingHoursEntry[];
  onChange: (next: WorkingHoursEntry[]) => void;
}) {
  const ordered = sortWorkingHoursByDay(workingHours);

  const updateEntry = (day: number, patch: Partial<WorkingHoursEntry>) => {
    onChange(
      ordered.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)),
    );
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
        Enable Saturday or Sunday to offer weekend slots. Disabled days will not generate availability.
      </p>
    </div>
  );
}

function SlotPicker({
  slots,
  value,
  loading,
  onChange,
}: {
  slots: CalendarSlot[];
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-12 animate-pulse rounded-xl bg-[#F1F5F9]" />
        ))}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center">
        <p className="text-sm font-medium text-[#475569]">No open slots on this date</p>
        <p className="mt-1 text-xs text-[#94A3B8]">Try another day or update availability settings below.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((slot) => {
        const key = slotKey(slot);
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left text-sm transition duration-200",
              active
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8] shadow-[0_4px_14px_rgba(37,99,235,0.15)] ring-1 ring-[#2563EB]/20"
                : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#BFDBFE] hover:bg-[#F8FBFF]",
            )}
          >
            <span className="block font-semibold">{formatSlotRange(slot.startAt, slot.endAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CalendarPanel() {
  const tenantId = getTenantId() ?? "";
  const searchParams = useSearchParams();
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [settings, setSettings] = useState<TenantCalendarSettings | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<CalendarSlot[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [note, setNote] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [manualDate, setManualDate] = useState(toDateInputValue(new Date()));
  const [manualSlot, setManualSlot] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [blackoutDraft, setBlackoutDraft] = useState("");
  const minBookingDate = useMemo(() => toDateInputValue(new Date()), []);

  const weekRange = useMemo(() => {
    const from = startOfWeek(weekAnchor);
    const to = endOfWeek(weekAnchor);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      label: formatWeekLabel(from, to),
      isCurrentWeek: isSameWeek(weekAnchor, new Date()),
    };
  }, [weekAnchor]);

  const groupedAppointments = useMemo(() => groupAppointmentsByDay(appointments), [appointments]);

  const stats = useMemo(
    () => ({
      total: appointments.length,
      ai: appointments.filter((item) => item.createdBy === "ai_agent").length,
      active: appointments.filter((item) => item.status !== "cancelled").length,
    }),
    [appointments],
  );

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    const [settingsResponse, appointmentsResponse] = await Promise.all([
      api.getCalendarSettings(tenantId),
      api.listCalendarAppointments(tenantId, weekRange.from, weekRange.to),
    ]);
    setSettings({
      ...settingsResponse.data,
      workingHours: sortWorkingHoursByDay(settingsResponse.data.workingHours || []),
    });
    setAppointments(appointmentsResponse.data);
  }, [tenantId, weekRange.from, weekRange.to]);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    refresh()
      .catch((error: Error) => setNote({ type: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, [tenantId, refresh]);

  useEffect(() => {
    const appointmentId = searchParams.get("appointment");
    if (!appointmentId || !appointments.length) return;
    const match = appointments.find((item) => item._id === appointmentId);
    if (match) setSelected(match);
  }, [appointments, searchParams]);

  useEffect(() => {
    if (!tenantId || !manualOpen) return;
    setSlotsLoading(true);
    api
      .getCalendarAvailability(tenantId, manualDate)
      .then((response) => {
        setAvailability(response.data);
        setManualSlot(response.data[0] ? slotKey(response.data[0]) : "");
      })
      .catch((error: Error) => setNote({ type: "error", text: error.message }))
      .finally(() => setSlotsLoading(false));
  }, [tenantId, manualOpen, manualDate]);

  const onSaveSettings = async () => {
    if (!tenantId || !settings) return;
    setBusy(true);
    setNote(null);
    try {
      const response = await api.putCalendarSettings(tenantId, settings);
      setSettings({
        ...response.data,
        workingHours: sortWorkingHoursByDay(response.data.workingHours || []),
      });
      setNote({ type: "success", text: "Availability settings saved." });
    } catch (error) {
      setNote({ type: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onCancelAppointment = async (appointment: Appointment) => {
    setBusy(true);
    setNote(null);
    try {
      await api.patchAppointment(appointment._id, { status: "cancelled" });
      setSelected(null);
      await refresh();
      setNote({ type: "success", text: "Booking cancelled." });
    } catch (error) {
      setNote({ type: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onCreateManual = async () => {
    if (!tenantId || !manualSlot) {
      setNote({ type: "info", text: "Pick a date and time slot to continue." });
      return;
    }
    if (manualDate < minBookingDate) {
      setNote({ type: "error", text: "You cannot book appointments in the past. Choose today or a future date." });
      return;
    }
    const [startAt, endAt] = manualSlot.split("|");
    setBusy(true);
    setNote(null);
    try {
      await api.createCalendarAppointment(tenantId, {
        customerName: manualName,
        customerPhone: manualPhone,
        startAt,
        endAt,
      });
      setManualOpen(false);
      setManualName("");
      setManualPhone("");
      setManualSlot("");
      await refresh();
      setNote({ type: "success", text: "Booking confirmed." });
    } catch (error) {
      setNote({ type: "error", text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openManualBooking = () => {
    setManualDate(toDateInputValue(new Date()));
    setManualSlot("");
    setManualOpen(true);
  };

  return (
    <WorkspaceGate>
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_10px_25px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">This week</p>
              <p className="mt-1 text-xl font-semibold text-[#0F172A]">{weekRange.label}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                <button
                  type="button"
                  onClick={() => setWeekAnchor((current) => addDays(current, -7))}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#475569] transition hover:bg-white hover:text-[#0F172A]"
                  aria-label="Previous week"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setWeekAnchor(new Date())}
                  disabled={weekRange.isCurrentWeek}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#475569] transition hover:bg-white hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setWeekAnchor((current) => addDays(current, 7))}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[#475569] transition hover:bg-white hover:text-[#0F172A]"
                  aria-label="Next week"
                >
                  →
                </button>
              </div>
              <Button onClick={openManualBooking} disabled={!tenantId}>
                New booking
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatChip label="Total bookings" value={stats.total} />
            <StatChip label="AI booked" value={stats.ai} />
            <StatChip label="Active" value={stats.active} />
          </div>

          {note ? (
            <InlineAlert variant={note.type} className="mt-4">
              {note.text}
            </InlineAlert>
          ) : null}
        </div>

        <DashboardPanel
          title="Schedule"
          description="Click a booking to view details. Enable weekend days in availability settings when needed."
        >
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-2xl bg-[#F1F5F9]" />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <>
                <EmptyState
                  title="No bookings this week"
                  description="Create one manually or let your voice agent schedule during calls."
                />
                <div className="mt-4 flex justify-center">
                  <Button onClick={openManualBooking}>New booking</Button>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                {groupedAppointments.map((group) => (
                  <section key={group.label} className="space-y-3">
                    <h3 className="text-sm font-semibold text-[#64748B]">{group.label}</h3>
                    <div className="space-y-2">
                      {group.items.map((appointment) => (
                        <AppointmentCard
                          key={appointment._id}
                          appointment={appointment}
                          selected={selected?._id === appointment._id}
                          onSelect={() => setSelected(appointment)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
        </DashboardPanel>

        <DashboardPanel
          title="Availability"
          description="Working hours and slot rules used when the AI agent offers appointments."
        >
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-left text-sm font-medium text-[#334155] transition hover:border-[#BFDBFE]"
          >
            <span>{settingsOpen ? "Hide availability settings" : "Show availability settings"}</span>
            <span className={cn("text-[#94A3B8] transition", settingsOpen && "rotate-180")}>▼</span>
          </button>

          {settingsOpen ? (
            settings ? (
              <div className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
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
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          slotDurationMinutes: Number(e.target.value) || 30,
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
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          bufferMinutes: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="maxDaily">Max bookings per day</Label>
                  <Input
                    id="maxDaily"
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={settings.maxDailyAppointments ?? ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxDailyAppointments: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-[#94A3B8]">Leave empty for no daily cap.</p>
                </div>
                <div>
                  <Label htmlFor="blackoutDraft">Blackout dates</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input
                      id="blackoutDraft"
                      type="date"
                      value={blackoutDraft}
                      onChange={(e) => setBlackoutDraft(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (!settings || !blackoutDraft) return;
                        const existing = new Set(settings.blackoutDates || []);
                        existing.add(blackoutDraft);
                        setSettings({
                          ...settings,
                          blackoutDates: [...existing].sort(),
                        });
                        setBlackoutDraft("");
                      }}
                      disabled={!blackoutDraft}
                    >
                      Add date
                    </Button>
                  </div>
                  {(settings.blackoutDates || []).length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(settings.blackoutDates || []).map((date) => (
                        <button
                          key={date}
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              blackoutDates: (settings.blackoutDates || []).filter((item) => item !== date),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-[#FEF2F2] px-3 py-1 text-xs font-medium text-[#B91C1C] transition hover:bg-[#FEE2E2]"
                        >
                          {date}
                          <span aria-hidden>×</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-[#94A3B8]">No blackout dates configured.</p>
                  )}
                </div>
                <div>
                  <Label>Working hours (all days)</Label>
                  <div className="mt-2">
                    <WorkingHoursEditor
                      workingHours={settings.workingHours}
                      onChange={(workingHours) => setSettings({ ...settings, workingHours })}
                    />
                  </div>
                </div>
                <Button onClick={onSaveSettings} disabled={busy}>
                  {busy ? "Saving..." : "Save availability"}
                </Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#64748B]">Loading settings…</p>
            )
          ) : null}
        </DashboardPanel>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.customerName ? `Booking — ${selected.customerName}` : "Booking details"}
        wide
      >
        {selected ? (
          <AppointmentDetail
            appointment={selected}
            busy={busy}
            onCancel={() => onCancelAppointment(selected)}
            onClose={() => setSelected(null)}
            showClose
          />
        ) : null}
      </Modal>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="New booking" wide>
        <div className="space-y-5">
          <p className="text-sm text-[#64748B]">
            Choose an open slot, then add customer details to confirm the booking.
          </p>

          <div>
            <Label htmlFor="manualDate">Date</Label>
            <Input
              id="manualDate"
              type="date"
              min={minBookingDate}
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Available slots</Label>
            <div className="mt-2">
              <SlotPicker
                slots={availability}
                value={manualSlot}
                loading={slotsLoading}
                onChange={setManualSlot}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="manualName">Customer name</Label>
              <Input
                id="manualName"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="manualPhone">Customer phone</Label>
              <Input
                id="manualPhone"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="+91 …"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#F1F5F9] pt-4">
            <Button variant="secondary" onClick={() => setManualOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={onCreateManual} disabled={busy || !manualSlot || slotsLoading}>
              {busy ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </div>
      </Modal>
    </WorkspaceGate>
  );
}
