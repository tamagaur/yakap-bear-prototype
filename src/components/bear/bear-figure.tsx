import clsx from "clsx";

export type BearMood = "idle" | "reminder" | "happy" | "ignored" | "sleepy";
export type LedColor = "green" | "blue" | "amber" | "gray";

const LED: Record<LedColor, { fill: string; className?: string; label: string }> = {
  green: { fill: "#4cc27a", label: "Status light: green — idle and connected" },
  blue: { fill: "#4a9be0", className: "animate-led-pulse", label: "Status light: blue, pulsing — reminder waiting" },
  amber: { fill: "#f2a33a", className: "animate-led-blink", label: "Status light: amber, blinking — low battery" },
  gray: { fill: "#a39a93", label: "Status light: gray — offline" },
};

const INK = "var(--color-cocoa-950)";

/**
 * Original Yakap Bear illustration (task S1). Plush proportions, a heart
 * status light on the chest, a speaker grille on the belly (with sound waves
 * while speaking) and a raised right paw that the PawButton sits on.
 */
export function BearFigure({
  mood,
  led,
  speaking,
  className,
  shakeKey = 0,
}: {
  mood: BearMood;
  led: LedColor;
  speaking: boolean;
  className?: string;
  /** Change to re-trigger the "ignored" head shake. */
  shakeKey?: number;
}) {
  const ledMeta = LED[led];
  const origin = { transformBox: "fill-box", transformOrigin: "50% 100%" } as const;
  return (
    <svg viewBox="0 0 300 340" className={clsx("w-full h-auto overflow-visible", className)} role="img" aria-label={`Yakap Bear — ${ledMeta.label}`}>
      <defs>
        <radialGradient id="fur-shade" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#c08a5d" />
          <stop offset="100%" stopColor="var(--color-fur)" />
        </radialGradient>
        <filter id="led-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <ellipse cx="150" cy="330" rx="112" ry="9" fill="var(--color-cocoa-900)" opacity="0.08" />

      <g className={clsx(mood === "reminder" ? "animate-wiggle" : mood !== "sleepy" && "animate-breathe")} style={origin}>
        {/* feet */}
        <ellipse cx="98" cy="310" rx="40" ry="23" fill="url(#fur-shade)" />
        <ellipse cx="202" cy="310" rx="40" ry="23" fill="url(#fur-shade)" />
        <ellipse cx="98" cy="314" rx="19" ry="10" fill="var(--color-paw-pad)" />
        <ellipse cx="202" cy="314" rx="19" ry="10" fill="var(--color-paw-pad)" />

        {/* left arm (resting) */}
        <ellipse cx="60" cy="238" rx="26" ry="47" transform="rotate(16 60 238)" fill="var(--color-fur-dark)" />
        {/* right arm (reaching towards the paw button) */}
        <ellipse cx="238" cy="252" rx="27" ry="52" transform="rotate(-42 238 252)" fill="var(--color-fur-dark)" />

        {/* body */}
        <ellipse cx="150" cy="250" rx="100" ry="82" fill="url(#fur-shade)" />
        <ellipse cx="150" cy="264" rx="60" ry="53" fill="var(--color-fur-light)" />

        {/* speaker grille */}
        <g opacity="0.75">
          {[254, 266, 278].map((y, r) =>
            (r === 1 ? [-24, -12, 0, 12, 24] : [-12, 0, 12]).map((dx) => (
              <circle key={`${y}-${dx}`} cx={150 + dx} cy={y} r="2.8" fill="var(--color-cocoa-400)" />
            )),
          )}
        </g>
        {speaking && (
          <g fill="none" stroke="var(--color-honey-500)" strokeWidth="4" strokeLinecap="round">
            <path d="M188 250 q10 16 0 32" className="animate-wave" style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }} />
            <path d="M198 242 q16 24 0 48" className="animate-wave [animation-delay:0.3s]" style={{ transformBox: "fill-box", transformOrigin: "0% 50%" }} />
            <path d="M112 250 q-10 16 0 32" className="animate-wave" style={{ transformBox: "fill-box", transformOrigin: "100% 50%" }} />
            <path d="M102 242 q-16 24 0 48" className="animate-wave [animation-delay:0.3s]" style={{ transformBox: "fill-box", transformOrigin: "100% 50%" }} />
          </g>
        )}

        {/* heart status light */}
        <path
          d="M150 212 l-10 -10 a6 6 0 0 1 10 -7.5 a6 6 0 0 1 10 7.5 z"
          fill={ledMeta.fill}
          filter="url(#led-glow)"
          opacity={led === "gray" ? 0 : 0.85}
          className={ledMeta.className}
          style={{ color: ledMeta.fill }}
        />
        <path
          d="M150 212 l-10 -10 a6 6 0 0 1 10 -7.5 a6 6 0 0 1 10 7.5 z"
          fill={ledMeta.fill}
          stroke="#fff"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          className={ledMeta.className}
        />

        {/* head */}
        <g key={shakeKey} className={clsx(mood === "ignored" && "animate-shake")} style={{ transformBox: "fill-box", transformOrigin: "50% 80%" }}>
          <circle cx="76" cy="60" r="34" fill="url(#fur-shade)" />
          <circle cx="224" cy="60" r="34" fill="url(#fur-shade)" />
          <circle cx="76" cy="60" r="19" fill="var(--color-paw-pad)" />
          <circle cx="224" cy="60" r="19" fill="var(--color-paw-pad)" />
          <ellipse cx="150" cy="112" rx="94" ry="80" fill="url(#fur-shade)" />
          <ellipse cx="150" cy="142" rx="45" ry="33" fill="var(--color-fur-light)" />

          {/* eyes */}
          {mood === "happy" ? (
            <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
              <path d="M104 108 q12 -14 24 0" />
              <path d="M172 108 q12 -14 24 0" />
            </g>
          ) : mood === "sleepy" ? (
            <g stroke={INK} strokeWidth="5" strokeLinecap="round">
              <path d="M104 106 h24" />
              <path d="M172 106 h24" />
            </g>
          ) : (
            <g className="animate-blink" style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}>
              <circle cx="116" cy={mood === "ignored" ? 108 : 104} r="10" fill={INK} />
              <circle cx="184" cy={mood === "ignored" ? 108 : 104} r="10" fill={INK} />
              <circle cx="112.5" cy={mood === "ignored" ? 105 : 100.5} r="3.2" fill="#fff" />
              <circle cx="180.5" cy={mood === "ignored" ? 105 : 100.5} r="3.2" fill="#fff" />
            </g>
          )}
          {mood === "ignored" && (
            // gently puzzled brows (inner ends raised) — never angry
            <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
              <path d="M104 92 l18 -6" />
              <path d="M196 92 l-18 -6" />
            </g>
          )}

          {/* cheeks */}
          <ellipse cx="96" cy="138" rx="14" ry="8.5" fill="#f5a3a3" opacity={mood === "happy" ? 0.85 : 0.5} />
          <ellipse cx="204" cy="138" rx="14" ry="8.5" fill="#f5a3a3" opacity={mood === "happy" ? 0.85 : 0.5} />

          {/* nose */}
          <path d="M135 127 q15 -9 30 0 q-4 15 -15 17 q-11 -2 -15 -17z" fill={INK} />
          <ellipse cx="144" cy="127" rx="4" ry="2" fill="#fff" opacity="0.35" />

          {/* mouth */}
          {mood === "happy" ? (
            <path d="M134 150 q16 20 32 0 q-16 8 -32 0z" fill={INK} />
          ) : mood === "reminder" ? (
            <ellipse cx="150" cy="156" rx="7" ry={speaking ? 7 : 4.5} fill={INK} className={speaking ? "animate-pulse" : undefined} />
          ) : mood === "ignored" ? (
            <path d="M141 156 q9 -3 18 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          ) : (
            <path d="M139 151 q11 10 22 0" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          )}
        </g>

        {/* floating hearts when a dose is recorded */}
        {mood === "happy" && (
          <g fill="#f07c8a">
            {[
              { x: 30, y: 60, delay: "0s" },
              { x: 272, y: 70, delay: "0.35s" },
              { x: 22, y: 120, delay: "0.7s" },
            ].map((h) => (
              <path
                key={h.x}
                d={`M${h.x} ${h.y} l-9 -9 a5.5 5.5 0 0 1 9 -7 a5.5 5.5 0 0 1 9 7 z`}
                className="animate-float-up"
                style={{ animationDelay: h.delay, transformBox: "fill-box", transformOrigin: "50% 50%" }}
              />
            ))}
          </g>
        )}
        {mood === "sleepy" && (
          <text x="238" y="30" fontSize="22" fontWeight="900" fill="var(--color-cocoa-400)">
            z<tspan dy="-10" fontSize="16">z</tspan>
          </text>
        )}
      </g>
    </svg>
  );
}
