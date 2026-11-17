import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export type CardVariant =
  | "paper"
  | "white"
  | "warm"
  | "peach"
  | "rose"
  | "lavender"
  | "mint"
  | "butter"
  | "dark"
  | "panel";

const VARIANTS: Record<CardVariant, string> = {
  paper: "bg-paper border border-line",
  white: "bg-white border border-line",
  warm: "bg-cream border border-line",
  peach: "bg-[#f9e0cf] border border-peach",
  rose: "bg-[#f6dcdd] border border-rose",
  lavender: "bg-[#e8e1f3] border border-lavender",
  mint: "bg-[#dcebe2] border border-mint",
  butter: "bg-butter border border-[#ecdb8f]",
  dark: "bg-cocoa text-paper border border-cocoa",
  panel: "bg-white/60 border border-line",
};

/** Surface for grouped content. `interactive` adds the hover lift; `selected` the teal border and tint. */
export function Card({
  className,
  variant = "white",
  interactive,
  selected,
  shadow,
  flat,
  ...rest
}: ComponentProps<"section"> & {
  variant?: CardVariant;
  interactive?: boolean;
  selected?: boolean;
  shadow?: boolean;
  flat?: boolean;
}) {
  return (
    <section
      className={clsx(
        "rounded-soft",
        VARIANTS[variant],
        // Cards sit above the page; `flat` opts out for nested panels.
        !flat && (shadow ? "shadow-soft" : "shadow-card"),
        interactive &&
          "motion-lift transition-[transform,box-shadow] duration-300 ease-out-expo hover:-translate-y-1 hover:shadow-card-hover active:scale-[0.99]",
        selected && "border-teal bg-teal/5",
        className,
      )}
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
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-cream text-cocoa-700">{icon}</span>
        )}
        <div className="min-w-0">
          <h2 className="text-[17px] leading-snug font-bold text-cocoa">{title}</h2>
          {description && <p className="mt-0.5 text-body text-muted">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
