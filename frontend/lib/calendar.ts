import type { Appointment, AppointmentStatus } from "@/lib/types";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function startOfWeek(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfWeek(date = new Date()) {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

export function formatAppointmentDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayHeading(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dateKey = date.toDateString();
  if (dateKey === today.toDateString()) return "Today";
  if (dateKey === tomorrow.toDateString()) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function formatTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatSlotRange(startAt?: string, endAt?: string) {
  if (!startAt) return "—";
  const start = formatTime(startAt);
  const end = endAt ? formatTime(endAt) : "";
  return end ? `${start} – ${end}` : start;
}

export function formatWeekLabel(from: Date, to: Date) {
  const sameMonth = from.getMonth() === to.getMonth();
  const fromLabel = from.toLocaleDateString([], { month: "short", day: "numeric" });
  const toLabel = to.toLocaleDateString(
    [],
    sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" },
  );
  const year = to.getFullYear();
  return `${fromLabel} – ${toLabel}, ${year}`;
}

export function initialsFromName(name?: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const APPOINTMENT_STATUS: Record<
  AppointmentStatus,
  { label: string; badge: string; dot: string }
> = {
  scheduled: {
    label: "Scheduled",
    badge: "bg-[#DBEAFE] text-[#1D4ED8]",
    dot: "bg-[#3B82F6]",
  },
  confirmed: {
    label: "Confirmed",
    badge: "bg-[#DCFCE7] text-[#15803D]",
    dot: "bg-[#22C55E]",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-[#F1F5F9] text-[#64748B]",
    dot: "bg-[#94A3B8]",
  },
  completed: {
    label: "Completed",
    badge: "bg-[#E0E7FF] text-[#4338CA]",
    dot: "bg-[#6366F1]",
  },
  no_show: {
    label: "No show",
    badge: "bg-[#FEE2E2] text-[#B91C1C]",
    dot: "bg-[#EF4444]",
  },
  hold: {
    label: "On hold",
    badge: "bg-[#FEF3C7] text-[#B45309]",
    dot: "bg-[#F59E0B]",
  },
};

export function statusMeta(status?: AppointmentStatus | string) {
  const key = String(status || "scheduled").toLowerCase() as AppointmentStatus;
  return APPOINTMENT_STATUS[key] ?? APPOINTMENT_STATUS.scheduled;
}

export function groupAppointmentsByDay(appointments: Appointment[]) {
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );
  const groups = new Map<string, { label: string; items: Appointment[] }>();

  for (const appointment of sorted) {
    const date = new Date(appointment.startAt);
    const key = Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(appointment);
      continue;
    }
    groups.set(key, {
      label: formatDayHeading(appointment.startAt),
      items: [appointment],
    });
  }

  return [...groups.values()];
}

export function slotKey(slot: { startAt: string; endAt: string }) {
  return `${slot.startAt}|${slot.endAt}`;
}

export const FULL_WEEK_TEMPLATE: Array<{ day: number; start: string; end: string; enabled: boolean }> = [
  { day: 0, start: "09:00", end: "18:00", enabled: false },
  { day: 1, start: "09:00", end: "18:00", enabled: true },
  { day: 2, start: "09:00", end: "18:00", enabled: true },
  { day: 3, start: "09:00", end: "18:00", enabled: true },
  { day: 4, start: "09:00", end: "18:00", enabled: true },
  { day: 5, start: "09:00", end: "18:00", enabled: true },
  { day: 6, start: "09:00", end: "18:00", enabled: false },
];

export function sortWorkingHoursByDay<T extends { day: number }>(entries: T[]) {
  return [...entries].sort((left, right) => left.day - right.day);
}
