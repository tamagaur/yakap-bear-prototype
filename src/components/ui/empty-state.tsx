import type { ReactNode } from "react";
import { BearMascot } from "../shared/bear-mascot";

export function EmptyState({
  title,
  children,
  action,
  mood = "calm",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  mood?: "happy" | "calm" | "sleepy";
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-cream-100">
        <BearMascot className="size-14" mood={mood} />
      </span>
      <h3 className="mt-4 text-base font-extrabold text-cocoa-900">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-cocoa-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
