"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/** 43×25 track, 19px thumb, teal when on. The button is a 44px-tall target. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 shrink-0 text-cocoa-700">{icon}</span>}
        <div className="min-w-0">
          <label htmlFor={id} className="text-body-lg font-bold text-cocoa">
            {label}
          </label>
          {description && <p className="text-body-sm text-muted">{description}</p>}
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="grid h-11 w-[43px] shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={clsx(
            "relative block h-[25px] w-[43px] rounded-full transition-colors duration-200",
            checked ? "bg-teal" : "bg-cocoa-300",
          )}
        >
          <span
            className={clsx(
              "absolute top-[3px] left-[3px] size-[19px] rounded-full bg-white shadow transition-transform duration-200",
              checked && "translate-x-[18px]",
            )}
          />
        </span>
      </button>
    </div>
  );
}
