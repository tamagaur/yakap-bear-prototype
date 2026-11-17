import clsx from "clsx";
import { Search } from "lucide-react";
import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";

const control =
  "min-h-11 w-full rounded-[10px] border border-line bg-white px-3.5 text-body-lg text-cocoa placeholder:text-cocoa-400 " +
  "transition-colors hover:border-cocoa-300 focus:border-teal disabled:bg-cream disabled:text-muted aria-invalid:border-red";

/**
 * Label + control + hint or error. The message is wired to the control with
 * aria-describedby (and aria-invalid for errors) automatically.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const child =
    isValidElement(children) && describedBy
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : children;
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-body font-bold text-cocoa">
        {label}
        {required && <span className="ml-1 font-semibold text-muted">(required)</span>}
      </label>
      {child}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-body-sm font-semibold text-missed-ink">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-body-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(control, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx(control, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={clsx(control, "pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({ className, ...rest }: ComponentProps<"input">) {
  return (
    <span className={clsx("relative block", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-cocoa-400"
        aria-hidden
      />
      <input type="search" className={clsx(control, "pl-10")} {...rest} />
    </span>
  );
}

/** Checkbox with a visible label; the whole row is the tap target. */
export function Checkbox({
  id,
  label,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { id: string; label: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={clsx("flex min-h-11 cursor-pointer items-start gap-3 text-body-lg text-cocoa", className)}
    >
      <input id={id} type="checkbox" className="mt-1 size-5 shrink-0 rounded accent-teal" {...rest} />
      <span>{label}</span>
    </label>
  );
}
