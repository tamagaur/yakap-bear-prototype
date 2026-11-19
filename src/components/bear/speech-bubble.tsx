import clsx from "clsx";
import { CircleAlert, CircleCheck, MessageCircleHeart } from "lucide-react";

/** Five rounded bars: short, medium, tall, medium, short. Animated while the reminder plays. */
export function SoundWave({ playing, className }: { playing: boolean; className?: string }) {
  const heights = [8, 14, 20, 14, 8];
  return (
    <span className={clsx("flex h-6 items-center gap-[3px]", className)} aria-hidden>
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

const TONE: Record<BubbleTone, { kicker: string; badge: string; ring: string }> = {
  normal: { kicker: "text-muted", badge: "bg-cream-deep text-cocoa-700", ring: "ring-line/70" },
  reminder: { kicker: "text-upcoming-ink", badge: "bg-upcoming-soft text-upcoming-ink", ring: "ring-upcoming/30" },
  success: { kicker: "text-taken-ink", badge: "bg-taken-soft text-taken-ink", ring: "ring-taken/30" },
  reject: { kicker: "text-late-ink", badge: "bg-late-soft text-late-ink", ring: "ring-late/35" },
};

/**
 * What the bear says out loud. A polite live region, so screen readers hear
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
  const t = TONE[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "relative mx-auto w-full max-w-[540px] rounded-[28px] bg-paper px-5 py-4 shadow-soft ring-1 transition-[box-shadow] duration-300 mobile:px-6 mobile:py-5",
        t.ring,
      )}
    >
      <div key={text} className="flex animate-bubble-in items-start gap-4">
        <span className={clsx("mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl", t.badge)} aria-hidden>
          {tone === "reminder" ? (
            <SoundWave playing={speaking} />
          ) : tone === "success" ? (
            <CircleCheck className="size-[22px]" />
          ) : tone === "reject" ? (
            <CircleAlert className="size-[22px]" />
          ) : (
            <MessageCircleHeart className="size-[22px]" />
          )}
        </span>
        <div className="min-w-0">
          {kicker && <p className={clsx("text-body-sm font-bold", t.kicker)}>{kicker}</p>}
          <p className="font-display mt-0.5 text-card-title font-extrabold text-balance text-cocoa tablet:text-title-sm">{text}</p>
          {sub && <p className="mt-1.5 text-body-lg text-pretty text-muted">{sub}</p>}
        </div>
      </div>
      <span aria-hidden className="absolute -bottom-[8px] left-1/2 size-4 -translate-x-1/2 rotate-45 rounded-[3px] bg-paper" />
    </div>
  );
}
