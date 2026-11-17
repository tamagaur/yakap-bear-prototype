"use client";

import clsx from "clsx";
import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem<T extends string> = { id: T; label: ReactNode };

/**
 * Tab list: teal active text with a 2px underline, arrow-key navigation,
 * and horizontal scrolling on narrow screens. Pair each tab with a panel
 * that has id `${idPrefix}-panel-${id}` and role="tabpanel".
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix = "tab",
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  idPrefix?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}
    >
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-${t.id}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={clsx(
              "-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-bold whitespace-nowrap transition-colors duration-200 ease-out",
              active ? "border-teal text-teal" : "border-transparent text-muted hover:text-cocoa",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
