"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type OptionElement = ReactElement<{
  value?: string;
  children?: ReactNode;
  disabled?: boolean;
}>;

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 280;

function collectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as OptionElement;
    if (el.type !== "option") return;
    const label = String(el.props.children ?? "").trim();
    const value = el.props.value ?? label;
    options.push({ value, label, disabled: el.props.disabled });
  });
  return options;
}

function measureMenu(trigger: HTMLButtonElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
  const spaceAbove = rect.top - MENU_GAP;
  const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    MENU_MAX_HEIGHT,
    window.innerHeight * 0.5,
    openUp ? spaceAbove : spaceBelow,
  );

  if (openUp) {
    return {
      bottom: window.innerHeight - rect.top + MENU_GAP,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(maxHeight, 120),
    };
  }

  return {
    top: rect.bottom + MENU_GAP,
    left: rect.left,
    width: rect.width,
    maxHeight: Math.max(maxHeight, 120),
  };
}

const chevron = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
    <path
      fillRule="evenodd"
      d="M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z"
      clipRule="evenodd"
    />
  </svg>
);

export function Select({
  className,
  children,
  value,
  onChange,
  id,
  disabled,
  required,
  name,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = collectOptions(children);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((opt) => opt.value === value) ?? options[0];
  const displayLabel = selected?.label ?? "Select…";

  function updateMenuPosition() {
    if (!triggerRef.current) return;
    setMenuPosition(measureMenu(triggerRef.current));
  }

  function toggleOpen() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    if (triggerRef.current) {
      setMenuPosition(measureMenu(triggerRef.current));
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onScroll() {
      updateMenuPosition();
    }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current || !value) return;
    const active = listRef.current.querySelector("[data-active='true']");
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [open, value, menuPosition]);

  function pick(nextValue: string) {
    if (disabled) return;
    setOpen(false);
    if (nextValue === value) return;
    onChange?.({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    } as React.ChangeEvent<HTMLSelectElement>);
  }

  const menuStyle: CSSProperties | undefined = menuPosition
    ? {
        position: "fixed",
        top: menuPosition.top,
        bottom: menuPosition.bottom,
        left: menuPosition.left,
        width: menuPosition.width,
        maxHeight: menuPosition.maxHeight,
        zIndex: 9999,
      }
    : undefined;

  const menu =
    open && !disabled && menuPosition
      ? createPortal(
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={id}
            style={menuStyle}
            className="select-drop overflow-y-auto rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-active={active ? "true" : "false"}
                    disabled={option.disabled}
                    onClick={() => !option.disabled && pick(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition",
                      option.disabled
                        ? "cursor-not-allowed text-[#CBD5E1]"
                        : active
                          ? "bg-[#EFF6FF] font-medium text-[#1D4ED8]"
                          : "text-[#334155] hover:bg-[#F8FAFC]",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active ? (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 flex-none text-[#2563EB]"
                        aria-hidden
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.79 6.8-6.8a1 1 0 011.4 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value ?? ""} required={required} /> : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={id ? `${id}-label` : undefined}
        onClick={toggleOpen}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-left text-sm transition-[border-color,box-shadow] duration-200",
          "focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20",
          disabled
            ? "cursor-not-allowed bg-[#F8FAFC] text-[#94A3B8]"
            : "text-[#0F172A] hover:border-[#94A3B8]",
          open && !disabled && "border-[#2563EB] ring-2 ring-[#2563EB]/20",
        )}
      >
        <span className={cn("truncate", !selected && "text-[#94A3B8]")}>{displayLabel}</span>
        <span
          className={cn(
            "flex-none text-[#94A3B8] transition-transform duration-200",
            open && "rotate-180 text-[#2563EB]",
          )}
        >
          {chevron}
        </span>
      </button>

      {menu}
    </div>
  );
}
