import clsx from "clsx";
import { useId } from "react";

export type BearExpression = "happy" | "puzzled" | "sleepy" | "proud";
/** Chest heart: honey patch by default, or a status light on the simulated device. */
export type HeartLight = "honey" | "green" | "blue" | "amber" | "gray";

/** Earlier simulator vocabulary, kept so the device logic reads naturally. */
export type BearMood = "idle" | "reminder" | "happy" | "ignored" | "sleepy";
export type LedColor = "green" | "blue" | "amber" | "gray";

const HEART: Record<HeartLight, { fill: string; className?: string }> = {
  honey: { fill: "#e7af37" },
  green: { fill: "#4cc27a" },
  blue: { fill: "#4a9be0", className: "animate-led-pulse" },
  amber: { fill: "#f2a33a", className: "animate-led-blink" },
  gray: { fill: "#a39a93" },
};

const INK = "#32211b";
const MOUTH = "#4a2d24";

/**
 * The Yakap Bear mascot: one SVG, four expressions, shared geometry
 * (280×330 reference canvas).
 * Decorative by default; pass `label` when the bear itself carries meaning.
 */
export function Bear({
  expression = "happy",
  heart = "honey",
  motion = "none",
  hearts = false,
  shakeKey = 0,
  label,
  className,
}: {
  expression?: BearExpression;
  heart?: HeartLight;
  motion?: "none" | "breathe" | "wiggle";
  /** Two small hearts float up (dose recorded). */
  hearts?: boolean;
  /** Change to re-trigger the gentle head shake. */
  shakeKey?: number;
  label?: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}-${uid}`;
  const light = HEART[heart];
  const box = { transformBox: "fill-box" } as const;

  return (
    <svg
      viewBox="0 0 280 350"
      className={clsx("h-auto overflow-visible drop-shadow-[0_22px_14px_rgba(77,51,31,0.17)]", className ?? "w-full")}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={id("head")} cx="40%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#c9946c" />
          <stop offset="100%" stopColor="#a86f49" />
        </radialGradient>
        <radialGradient id={id("body")} cx="40%" cy="20%" r="80%">
          <stop offset="0%" stopColor="#bc835c" />
          <stop offset="100%" stopColor="#955f40" />
        </radialGradient>
        <pattern id={id("plush")} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="0.75" fill="#fff" />
        </pattern>
        <filter id={id("glow")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g
        className={clsx(motion === "wiggle" && "animate-wiggle", motion === "breathe" && "animate-breathe")}
        style={{ ...box, transformOrigin: "50% 100%" }}
      >
        {/* ears, behind the head */}
        {[67, 213].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="53" r="39" fill="#c58f68" />
            <circle cx={cx} cy="53" r="25" fill="#8e5d3f" />
            <circle cx={cx} cy="53" r="21" fill="#9d6845" />
          </g>
        ))}

        {/* body */}
        <ellipse cx="140" cy="255.5" rx="85" ry="67.5" fill={`url(#${id("body")})`} stroke="#7f5138" strokeWidth="3" />
        <ellipse cx="140" cy="255.5" rx="76" ry="59" fill={`url(#${id("plush")})`} opacity="0.2" />

        {/* heart patch / status light */}
        {heart !== "honey" && heart !== "gray" && (
          <path
            d="M140 262 l-13 -13 a7.6 7.6 0 0 1 13 -9.6 a7.6 7.6 0 0 1 13 9.6 z"
            fill={light.fill}
            filter={`url(#${id("glow")})`}
            opacity="0.85"
            className={light.className}
            style={{ color: light.fill }}
          />
        )}
        <path d="M140 264 l-13 -13 a7.6 7.6 0 0 1 13 -9.6 a7.6 7.6 0 0 1 13 9.6 z" fill="#704d35" />
        <path
          d="M140 262 l-13 -13 a7.6 7.6 0 0 1 13 -9.6 a7.6 7.6 0 0 1 13 9.6 z"
          fill={light.fill}
          className={light.className}
        />

        {/* dotted seam */}
        <g fill="#6f4934">
          {[118, 129, 140, 151, 162].map((x) => (
            <circle key={x} cx={x} cy="304" r="1.5" />
          ))}
        </g>

        {/* arms, rotated outward 24° */}
        <ellipse cx="53" cy="264" rx="36" ry="69" transform="rotate(24 53 264)" fill="#a86f49" stroke="#7f5138" strokeWidth="3" />
        <ellipse cx="227" cy="264" rx="36" ry="69" transform="rotate(-24 227 264)" fill="#a86f49" stroke="#7f5138" strokeWidth="3" />

        {/* legs */}
        <ellipse cx="85.5" cy="303.5" rx="46.5" ry="42.5" transform="rotate(-8 85.5 303.5)" fill="#a86f49" stroke="#7f5138" strokeWidth="3" />
        <ellipse cx="194.5" cy="303.5" rx="46.5" ry="42.5" transform="rotate(8 194.5 303.5)" fill="#a86f49" stroke="#7f5138" strokeWidth="3" />

        {/* head */}
        <g key={shakeKey} className={clsx(shakeKey > 0 && "animate-shake")} style={{ ...box, transformOrigin: "50% 80%" }}>
          <ellipse cx="140" cy="126" rx="106" ry="95" fill={`url(#${id("head")})`} stroke="#87583d" strokeWidth="3" />
          <ellipse cx="140" cy="126" rx="97" ry="86" fill={`url(#${id("plush")})`} opacity="0.2" />

          {/* stitched × */}
          <g stroke="#72462e" strokeWidth="1.8" strokeLinecap="round" transform="rotate(12 211 63)">
            <path d="M207 59 l8 8M215 59 l-8 8" />
          </g>

          {/* eyes */}
          {expression === "sleepy" ? (
            <g fill="none" stroke={MOUTH} strokeWidth="4" strokeLinecap="round">
              <path d="M84 113 Q97 124 110 113" />
              <path d="M170 113 Q183 124 196 113" />
            </g>
          ) : expression === "proud" ? (
            <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
              <path d="M87 117 Q97.5 103 108 117" />
              <path d="M172 117 Q182.5 103 193 117" />
            </g>
          ) : (
            <g className="animate-blink" style={{ ...box, transformOrigin: "50% 50%" }}>
              <ellipse cx="97.5" cy="113" rx="8.5" ry="10" fill={INK} />
              <ellipse cx="182.5" cy="113" rx="8.5" ry="10" fill={INK} />
              <circle cx="94.5" cy="108.5" r="2.5" fill="#fff" />
              <circle cx="179.5" cy="108.5" r="2.5" fill="#fff" />
            </g>
          )}
          {expression === "puzzled" && (
            // asymmetric brows: curious, never cross
            <g fill="none" stroke={MOUTH} strokeWidth="3.5" strokeLinecap="round">
              <path d="M84 91 Q96 82 108 88" />
              <path d="M172 92 Q183 89 194 92" />
            </g>
          )}

          {/* muzzle, nose, mouth */}
          <ellipse cx="140" cy="162" rx="44" ry="35" fill="#e1b58e" stroke="#946346" strokeWidth="2" />
          <ellipse cx="140" cy="148.5" rx="12" ry="8.5" fill={MOUTH} />
          {expression === "puzzled" ? (
            <circle cx="140" cy="171" r="7.5" fill="none" stroke={MOUTH} strokeWidth="3" />
          ) : expression === "sleepy" ? (
            <path d="M131 168 Q140 173 149 168" fill="none" stroke={MOUTH} strokeWidth="3" strokeLinecap="round" />
          ) : expression === "proud" ? (
            <path d="M124 165 Q140 182 156 165" fill="none" stroke={MOUTH} strokeWidth="3.2" strokeLinecap="round" />
          ) : (
            <path d="M128 166 Q140 177 152 166" fill="none" stroke={MOUTH} strokeWidth="3" strokeLinecap="round" />
          )}
        </g>

        {hearts && (
          <g fill="#e58a96">
            {[
              { x: 26, y: 70, delay: "0s" },
              { x: 256, y: 84, delay: "0.4s" },
            ].map((h) => (
              <path
                key={h.x}
                d={`M${h.x} ${h.y} l-9 -9 a5.5 5.5 0 0 1 9 -7 a5.5 5.5 0 0 1 9 7 z`}
                className="animate-float-up"
                style={{ ...box, animationDelay: h.delay, transformOrigin: "50% 50%" }}
              />
            ))}
          </g>
        )}
        {expression === "sleepy" && (
          <text x="232" y="34" fontSize="22" fontWeight="800" fill="#b3a69d">
            z<tspan dy="-10" fontSize="16">z</tspan>
          </text>
        )}
      </g>
    </svg>
  );
}

const MOOD_EXPRESSION: Record<BearMood, BearExpression> = {
  idle: "happy",
  reminder: "happy",
  happy: "proud",
  ignored: "puzzled",
  sleepy: "sleepy",
};

/** The simulated device: the mascot plus mood-driven motion and the heart status light. */
export function BearFigure({
  mood,
  led,
  className,
  shakeKey = 0,
}: {
  mood: BearMood;
  led: LedColor;
  /** Kept for callers; the design shows sound bars in the speech bubble instead of on the chest. */
  speaking?: boolean;
  className?: string;
  shakeKey?: number;
}) {
  return (
    <Bear
      expression={MOOD_EXPRESSION[mood]}
      heart={led}
      motion={mood === "reminder" ? "wiggle" : mood === "sleepy" ? "none" : "breathe"}
      hearts={mood === "happy"}
      shakeKey={mood === "ignored" ? shakeKey : 0}
      className={className}
    />
  );
}
