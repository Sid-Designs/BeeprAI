"use client";

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/20"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md border-l border-[#E2E8F0] bg-white shadow-2xl transition-transform duration-300 sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-4">
          <h3 className="text-base font-semibold text-[#0F172A]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            Close
          </button>
        </div>
        <div className="h-[calc(100%-4.5rem)] overflow-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}
