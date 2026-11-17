import clsx from "clsx";
import Link from "next/link";

/** The brand mark's bear face, drawn as a line icon on the 24px icon grid. */
export function BearMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx(className ?? "size-5")}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="3" />
      <circle cx="17" cy="7" r="3" />
      <circle cx="12" cy="13" r="8" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <path d="M10 16c1.2 1 2.8 1 4 0" />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={clsx("grid shrink-0 place-items-center rounded-xl bg-teal text-white", className ?? "size-10")}>
      <BearMark className="size-[58%]" />
    </span>
  );
}

export function Logo({
  href = "/",
  subtitle,
  tone = "dark",
  className,
}: {
  href?: string;
  subtitle?: string;
  tone?: "dark" | "light";
  className?: string;
}) {
  return (
    <Link href={href} className={clsx("inline-flex items-center gap-3 rounded-xl", className)}>
      <LogoMark className={clsx("size-10", tone === "light" && "bg-white/12 ring-1 ring-white/20")} />
      <span className="leading-tight">
        <span className={clsx("font-display block text-[19px] font-bold", tone === "dark" ? "text-cocoa" : "text-white")}>
          Yakap Bear
        </span>
        {subtitle && (
          <span className={clsx("block text-[11px] font-medium", tone === "dark" ? "text-muted" : "text-white/65")}>
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
