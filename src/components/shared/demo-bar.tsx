"use client";

import clsx from "clsx";
import { Clock3, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useSimClock } from "@/hooks/use-sim-clock";
import { formatDate, formatTime } from "@/lib/time";

/** Thin strip showing the shared simulated time on every view. */
export function DemoBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { now, error } = useSimClock();
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 px-4 py-1.5 text-xs font-bold",
        tone === "light" ? "bg-cocoa-900 text-cream-100" : "bg-cocoa-950 text-cream-200",
      )}
    >
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <FlaskConical className="size-3.5 text-honey-300" aria-hidden />
        <span className="sm:hidden">Prototype</span>
        <span className="hidden sm:inline">Prototype · fictional demo data</span>
      </span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular" aria-live="polite">
        <Clock3 className="size-3.5 text-honey-300" aria-hidden />
        {error ? (
          <span className="text-missed-soft">Demo clock offline</span>
        ) : now ? (
          <>
            <span className="hidden sm:inline">Demo time</span> {formatDate(now)} ·{" "}
            <span className="text-honey-200">{formatTime(now)}</span>
          </>
        ) : (
          "Demo time …"
        )}
      </span>
      <Link href="/" className="hidden sm:inline underline-offset-2 hover:underline text-cream-200">
        Demo launcher
      </Link>
    </div>
  );
}
