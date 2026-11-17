import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, Lock, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "danger" | "error" | "privacy" | "neutral";

const STYLES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-upcoming-soft text-upcoming-ink border-blue/20", icon: <Info className="size-[18px]" /> },
  success: { box: "bg-taken-soft text-taken-ink border-taken/25", icon: <CheckCircle2 className="size-[18px]" /> },
  warning: { box: "bg-late-soft text-late-ink border-late/30", icon: <AlertTriangle className="size-[18px]" /> },
  danger: { box: "bg-missed-soft text-missed-ink border-red/20", icon: <XCircle className="size-[18px]" /> },
  error: { box: "bg-missed-soft text-missed-ink border-red/20", icon: <XCircle className="size-[18px]" /> },
  privacy: { box: "bg-[#e9f3ee] text-[#1f4f4a] border-mint", icon: <Lock className="size-[18px]" /> },
  neutral: { box: "bg-cream text-cocoa-700 border-line", icon: <Info className="size-[18px]" /> },
};

/** Icon + bold title + body + optional action. Meaning never rests on color alone. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const s = STYLES[tone];
  const urgent = tone === "error" || tone === "danger";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={clsx("flex gap-3 rounded-[14px] border px-4 py-3 text-body", s.box, className)}
    >
      <span className="mt-px shrink-0" aria-hidden>
        {s.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
