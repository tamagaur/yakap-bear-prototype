import clsx from "clsx";
import Link from "next/link";
import { BearMascot } from "./bear-mascot";

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
    <Link href={href} className={clsx("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-10 place-items-center rounded-2xl bg-cream-200">
        <BearMascot className="size-8" />
      </span>
      <span className="leading-tight">
        <span className={clsx("block text-[17px] font-black tracking-tight", tone === "dark" ? "text-cocoa-900" : "text-cream-50")}>
          Yakap Bear
        </span>
        {subtitle && (
          <span className={clsx("block text-xs font-semibold", tone === "dark" ? "text-cocoa-600" : "text-cocoa-300")}>
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
