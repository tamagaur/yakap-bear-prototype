import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "error";

const STYLES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-upcoming-soft text-upcoming-ink ring-upcoming/20", icon: <Info className="size-4" /> },
  success: { box: "bg-taken-soft text-taken-ink ring-taken/20", icon: <CheckCircle2 className="size-4" /> },
  warning: { box: "bg-late-soft text-late-ink ring-late/25", icon: <AlertTriangle className="size-4" /> },
  error: { box: "bg-missed-soft text-missed-ink ring-missed/20", icon: <XCircle className="size-4" /> },
};

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
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={clsx("flex gap-3 rounded-2xl px-4 py-3 text-sm ring-1", s.box, className)}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
