import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={clsx("rounded-3xl bg-white ring-1 ring-cocoa-200/70 shadow-soft", className)}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-cream-100 text-cocoa-700">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-cocoa-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-cocoa-600">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
