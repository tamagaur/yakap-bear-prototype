import clsx from "clsx";
import { Volume2 } from "lucide-react";

export function SpeechBubble({
  text,
  sub,
  speaking,
  tone,
}: {
  text: string;
  sub?: string;
  speaking: boolean;
  tone: "normal" | "reminder" | "success" | "reject";
}) {
  return (
    <div
      aria-live="polite"
      className={clsx(
        "relative mx-auto w-full max-w-sm rounded-3xl px-5 py-3.5 text-center shadow-soft ring-1 animate-fade-in",
        tone === "reminder" && "bg-upcoming-soft ring-upcoming/25",
        tone === "success" && "bg-taken-soft ring-taken/25",
        tone === "reject" && "bg-late-soft ring-late/25",
        tone === "normal" && "bg-white ring-cocoa-200",
      )}
    >
      <p className="text-[17px] font-extrabold leading-snug text-cocoa-900">{text}</p>
      {sub && <p className="mt-1 text-sm font-semibold text-cocoa-600">{sub}</p>}
      {speaking && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold text-honey-700">
          <Volume2 className="size-3.5 animate-pulse" aria-hidden /> Playing the family&apos;s message
        </p>
      )}
      <span
        aria-hidden
        className={clsx(
          "absolute -bottom-2 left-1/2 size-4 -translate-x-1/2 rotate-45 ring-1 [clip-path:polygon(100%_0,100%_100%,0_100%)]",
          tone === "reminder" && "bg-upcoming-soft ring-upcoming/25",
          tone === "success" && "bg-taken-soft ring-taken/25",
          tone === "reject" && "bg-late-soft ring-late/25",
          tone === "normal" && "bg-white ring-cocoa-200",
        )}
      />
    </div>
  );
}
