import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "teal" | "secondary" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-honey text-cocoa-950 shadow-button hover:-translate-y-px active:translate-y-[3px] active:shadow-button-pressed disabled:shadow-none",
  teal:
    "bg-teal text-white shadow-[0_6px_0_#245d57,0_14px_24px_rgba(47,117,110,0.16)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_3px_0_#245d57] disabled:shadow-none",
  secondary:
    "bg-white text-cocoa border border-line hover:-translate-y-px hover:border-cocoa-300 active:translate-y-0 active:bg-cream",
  ghost: "text-muted hover:bg-cocoa/5 hover:text-cocoa active:bg-cocoa/10",
  danger:
    "bg-[#fff0ee] text-missed-ink border border-red/25 hover:-translate-y-px hover:bg-missed-soft active:translate-y-0",
  dark: "bg-cocoa text-paper hover:-translate-y-px hover:bg-cocoa-800 active:translate-y-0",
};
const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-body gap-1.5",
  md: "min-h-11 px-[18px] text-sm gap-2",
  lg: "min-h-12 px-5 text-body-lg gap-2",
  icon: "size-11 shrink-0",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return clsx(
    "motion-lift inline-flex items-center justify-center rounded-xl font-bold whitespace-nowrap select-none",
    "transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out-expo active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:translate-y-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; trailingIcon?: ReactNode; full?: boolean };

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  trailingIcon,
  full,
  className,
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & Common & { loading?: boolean }) {
  return (
    <button
      type="button"
      className={buttonClasses(variant, size, clsx(full && "w-full", className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {trailingIcon}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  icon,
  trailingIcon,
  full,
  children,
  ...rest
}: ComponentProps<typeof Link> & Common) {
  return (
    <Link className={buttonClasses(variant, size, clsx(full && "w-full", className))} {...rest}>
      {icon}
      {children}
      {trailingIcon}
    </Link>
  );
}
