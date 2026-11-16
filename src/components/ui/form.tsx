import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

const control =
  "h-11 w-full rounded-xl bg-white px-3.5 text-[15px] text-cocoa-900 ring-1 ring-cocoa-200 placeholder:text-cocoa-400 " +
  "focus:outline-none focus:ring-2 focus:ring-honey-500 disabled:bg-cream-100 disabled:text-cocoa-500";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-bold text-cocoa-800">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-semibold text-missed-ink">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-cocoa-500">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(control, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={clsx(control, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}
