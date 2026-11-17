import clsx from "clsx";

/** Five rounded bars: short, medium, tall, medium, short. Animated while the reminder plays. */
export function SoundWave({ playing, className }: { playing: boolean; className?: string }) {
  const heights = [10, 18, 26, 18, 10];
  return (
    <span className={clsx("flex h-7 items-center gap-[3px] text-blue", className)} aria-hidden>
      {heights.map((h, i) => (
        <span
          key={i}
          className={clsx("w-[3px] origin-center rounded-full bg-current", playing && "animate-sound")}
          style={{ height: h, animationDelay: `${i * 90}ms` }}
        />
      ))}
    </span>
  );
}

export type BubbleTone = "normal" | "reminder" | "success" | "reject";

const KICKER: Record<BubbleTone, string> = {
  normal: "text-muted",
  reminder: "text-blue",
  success: "text-taken-ink",
  reject: "text-late-ink",
};

/**
 * What the bear is "saying". A polite live region, so screen readers hear
 * reminders and the result of each paw hold.
 */
export function SpeechBubble({
  kicker,
  text,
  sub,
  speaking,
  tone,
}: {
  kicker?: string;
  text: string;
  sub?: string;
  speaking: boolean;
  tone: BubbleTone;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="relative mx-auto w-full max-w-[510px] rounded-card border border-line bg-white px-6 py-5 shadow-soft"
    >
      <div key={text} className="flex animate-bubble-in items-start gap-4">
        {tone === "reminder" && <SoundWave playing={speaking} className="mt-5 shrink-0" />}
        <div className="min-w-0">
          {kicker && <p className={clsx("eyebrow", KICKER[tone])}>{kicker}</p>}
          <p className="font-display mt-1 text-card-title font-bold text-cocoa tablet:text-title-sm">{text}</p>
          {sub && <p className="mt-1.5 text-body text-muted">{sub}</p>}
        </div>
      </div>
      <span
        aria-hidden
        className="absolute -bottom-[9px] left-1/2 size-4 -translate-x-1/2 rotate-45 border-r border-b border-line bg-white"
      />
    </div>
  );
}
