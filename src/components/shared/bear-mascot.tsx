import clsx from "clsx";

/** Small original bear-face mascot for the logo and empty states. */
export function BearMascot({ className, mood = "happy" }: { className?: string; mood?: "happy" | "calm" | "sleepy" }) {
  return (
    <svg viewBox="0 0 64 60" className={clsx(className ?? "size-10")} aria-hidden>
      <circle cx="14" cy="14" r="10" fill="var(--color-fur)" />
      <circle cx="50" cy="14" r="10" fill="var(--color-fur)" />
      <circle cx="14" cy="14" r="5.5" fill="var(--color-paw-pad)" />
      <circle cx="50" cy="14" r="5.5" fill="var(--color-paw-pad)" />
      <ellipse cx="32" cy="33" rx="25" ry="23" fill="var(--color-fur)" />
      <ellipse cx="32" cy="41" rx="12.5" ry="9.5" fill="var(--color-fur-light)" />
      <ellipse cx="32" cy="37.5" rx="4" ry="3" fill="var(--color-cocoa-900)" />
      {mood === "sleepy" ? (
        <>
          <path d="M19 30h7M38 30h7" stroke="var(--color-cocoa-900)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : mood === "happy" ? (
        <>
          <path d="M18.5 31q3.5-4 7 0M38.5 31q3.5-4 7 0" fill="none" stroke="var(--color-cocoa-900)" strokeWidth="2.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="22" cy="30" r="2.6" fill="var(--color-cocoa-900)" />
          <circle cx="42" cy="30" r="2.6" fill="var(--color-cocoa-900)" />
        </>
      )}
      <path d="M28.5 43q3.5 3 7 0" fill="none" stroke="var(--color-cocoa-900)" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="17" cy="38" rx="3.6" ry="2.2" fill="#f5a3a3" opacity="0.6" />
      <ellipse cx="47" cy="38" rx="3.6" ry="2.2" fill="#f5a3a3" opacity="0.6" />
    </svg>
  );
}
